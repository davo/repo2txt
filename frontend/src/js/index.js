import JSZip from 'jszip'
import { createIcons, icons } from 'lucide'
import { displayDirectoryStructure, getSelectedFiles, formatRepoContents } from './utils.js'
import { WikiService } from './wikiService.js'
import { createPageHeader } from '../components/PageHeader.js'
import { patch } from '../core/dom.js'

// Initialize Lucide icons
function initializeLucide() {
	createIcons({
		icons,
	})
}

// Load saved token on page load
document.addEventListener('DOMContentLoaded', function () {
	// Initialize header
	const headerMount = document.getElementById('header-mount')
	const header = createPageHeader({
		title: 'GitHub to Plain Text',
		subtitle: 'Convert Code in GitHub to a Single Formatted Text File',
	}).setHooks({
		afterMount: () => {
			// Re-initialize Lucide icons after mounting
			initializeLucide()
		},
	})

	// Mount header component
	header.mount(headerMount)

	initializeLucide()
	setupShowMoreInfoButton()
	loadSavedToken()
})

// Load saved token from local storage
function loadSavedToken() {
	const savedToken = localStorage.getItem('githubAccessToken')
	if (savedToken) {
		document.getElementById('accessToken').value = savedToken
	}
}

// Save token to local storage
function saveToken(token) {
	if (token) {
		localStorage.setItem('githubAccessToken', token)
	} else {
		localStorage.removeItem('githubAccessToken')
	}
}

// Event listener for form submission
document.getElementById('repoForm').addEventListener('submit', async function (e) {
	e.preventDefault()
	const repoUrl = document.getElementById('repoUrl').value
	const accessToken = document.getElementById('accessToken').value

	// Save token automatically
	saveToken(accessToken)

	const outputText = document.getElementById('outputText')
	outputText.value = ''

	try {
		// Parse repository URL
		const { owner, repo, lastString, isWiki } = parseRepoUrl(repoUrl)

		if (isWiki) {
			// Handle wiki repository using our backend service
			const wikiService = new WikiService()
			const wikiContents = await wikiService.fetchWikiContents(owner, repo, accessToken)

			// Convert wiki contents to the expected tree format
			const tree = wikiContents.map((content) => ({
				path: content.path,
				type: 'blob',
				url: URL.createObjectURL(new Blob([content.text], { type: 'text/markdown' })),
			}))

			displayDirectoryStructure(tree)
		} else {
			// Handle regular repository (existing code)
			let refFromUrl = ''
			let pathFromUrl = ''

			if (lastString) {
				const references = await getReferences(owner, repo, accessToken)
				const allRefs = [...references.branches, ...references.tags]

				const matchingRef = allRefs.find((ref) => lastString.startsWith(ref))
				if (matchingRef) {
					refFromUrl = matchingRef
					pathFromUrl = lastString.slice(matchingRef.length + 1)
				} else {
					refFromUrl = lastString
				}
			}

			const sha = await fetchRepoSha(owner, repo, refFromUrl, pathFromUrl, accessToken)
			const tree = await fetchRepoTree(owner, repo, sha, accessToken)
			displayDirectoryStructure(tree)
		}

		document.getElementById('generateTextButton').style.display = 'flex'
		document.getElementById('downloadZipButton').style.display = 'flex'

		// Reinitialize Lucide icons
		initializeLucide()
	} catch (error) {
		outputText.value =
			`Error fetching repository contents: ${error.message}\n\n` +
			'Please ensure:\n' +
			'1. The repository URL is correct and accessible.\n' +
			'2. You have the necessary permissions to access the repository.\n' +
			"3. If it's a private repository, you've provided a valid access token.\n" +
			'4. The specified branch/tag and path (if any) exist in the repository.'
	}
})

// Event listener for generating text file
document.getElementById('generateTextButton').addEventListener('click', async function () {
	const accessToken = document.getElementById('accessToken').value
	const outputText = document.getElementById('outputText')
	outputText.value = ''

	// Save token automatically
	saveToken(accessToken)

	try {
		const selectedFiles = getSelectedFiles()
		if (selectedFiles.length === 0) {
			throw new Error('No files selected')
		}
		const fileContents = await fetchFileContents(selectedFiles, accessToken)
		const formattedText = formatRepoContents(fileContents)
		outputText.value = formattedText

		document.getElementById('copyButton').style.display = 'flex'
		document.getElementById('downloadButton').style.display = 'flex'
	} catch (error) {
		outputText.value =
			`Error generating text file: ${error.message}\n\n` +
			'Please ensure:\n' +
			'1. You have selected at least one file from the directory structure.\n' +
			'2. Your access token (if provided) is valid and has the necessary permissions.\n' +
			'3. You have a stable internet connection.\n' +
			'4. The GitHub API is accessible and functioning normally.'
	}
})

// Event listener for downloading zip file
document.getElementById('downloadZipButton').addEventListener('click', async function () {
	const accessToken = document.getElementById('accessToken').value

	try {
		const selectedFiles = getSelectedFiles()
		if (selectedFiles.length === 0) {
			throw new Error('No files selected')
		}
		const fileContents = await fetchFileContents(selectedFiles, accessToken)
		await createAndDownloadZip(fileContents)
	} catch (error) {
		const outputText = document.getElementById('outputText')
		outputText.value =
			`Error generating zip file: ${error.message}\n\n` +
			'Please ensure:\n' +
			'1. You have selected at least one file from the directory structure.\n' +
			'2. Your access token (if provided) is valid and has the necessary permissions.\n' +
			'3. You have a stable internet connection.\n' +
			'4. The GitHub API is accessible and functioning normally.'
	}
})

// Event listener for copying text to clipboard
document.getElementById('copyButton').addEventListener('click', function () {
	const outputText = document.getElementById('outputText')
	outputText.select()
	navigator.clipboard
		.writeText(outputText.value)
		.then(() => console.log('Text copied to clipboard'))
		.catch((err) => console.error('Failed to copy text: ', err))
})

// Event listener for downloading text file
document.getElementById('downloadButton').addEventListener('click', function () {
	const outputText = document.getElementById('outputText').value
	if (!outputText.trim()) {
		document.getElementById('outputText').value =
			'Error: No content to download. Please generate the text file first.'
		return
	}
	const blob = new Blob([outputText], { type: 'text/plain' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = 'prompt.txt'
	a.click()
	URL.revokeObjectURL(url)
})

// Parse GitHub repository URL
function parseRepoUrl(url) {
	url = url.replace(/\/$/, '')
	// Support both regular repos and wiki repos
	const urlPattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.wiki)?(\.git)?(\/tree\/(.+))?$/
	const match = url.match(urlPattern)
	if (!match) {
		throw new Error(
			'Invalid GitHub repository URL. Please ensure the URL is in the correct format: ' +
				'https://github.com/owner/repo, https://github.com/owner/repo.wiki.git, or https://github.com/owner/repo/tree/branch/path'
		)
	}
	return {
		owner: match[1],
		repo: match[2] + (match[3] || ''), // Include .wiki if present
		lastString: match[6] || '',
		isWiki: !!match[3], // Boolean flag indicating if it's a wiki repo
	}
}

// Fetch repository references
async function getReferences(owner, repo, token) {
	// For wiki repos, we only use the master branch
	if (repo.endsWith('.wiki')) {
		return {
			branches: ['master'],
			tags: [],
		}
	}

	const headers = {
		Accept: 'application/vnd.github+json',
	}
	if (token) {
		headers['Authorization'] = `token ${token}`
	}

	const [branchesResponse, tagsResponse] = await Promise.all([
		fetch(`https://api.github.com/repos/${owner}/${repo}/git/matching-refs/heads/`, { headers }),
		fetch(`https://api.github.com/repos/${owner}/${repo}/git/matching-refs/tags/`, { headers }),
	])

	if (!branchesResponse.ok || !tagsResponse.ok) {
		throw new Error('Failed to fetch references')
	}

	const branches = await branchesResponse.json()
	const tags = await tagsResponse.json()

	// Extract branch names and prioritize default branches
	const defaultBranches = ['master', 'main', 'dev']
	const branchNames = branches.map((b) => b.ref.split('/').slice(2).join('/'))

	// Sort branches to put default branches first, in specified order
	const sortedBranches = [
		...defaultBranches.filter((b) => branchNames.includes(b)),
		...branchNames.filter((b) => !defaultBranches.includes(b)),
	]

	return {
		branches: sortedBranches,
		tags: tags.map((t) => t.ref.split('/').slice(2).join('/')),
	}
}

// Update info icon
function updateInfoIcon(button, tokenInfo) {
	const icon = button.querySelector('[data-lucide]')
	if (icon) {
		icon.setAttribute('data-lucide', tokenInfo.classList.contains('hidden') ? 'info' : 'x')
		initializeLucide()
	}
}

// Setup show more info button
function setupShowMoreInfoButton() {
	const showMoreInfoButton = document.getElementById('showMoreInfo')
	const tokenInfo = document.getElementById('tokenInfo')

	showMoreInfoButton.addEventListener('click', function () {
		tokenInfo.classList.toggle('hidden')
		updateInfoIcon(this, tokenInfo)
	})
}

// Fetch repository SHA
async function fetchRepoSha(owner, repo, ref, path, token) {
	const isWiki = repo.endsWith('.wiki')
	// For wikis, always use master branch and treat as a regular git repo
	const actualRef = isWiki ? 'master' : ref || 'master'

	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path ? `${path}` : ''}${actualRef ? `?ref=${actualRef}` : ''}`
	const headers = {
		Accept: 'application/vnd.github.object+json',
	}
	if (token) {
		headers['Authorization'] = `token ${token}`
	}
	const response = await fetch(url, { headers })
	if (!response.ok) {
		handleFetchError(response)
	}
	const data = await response.json()
	return data.sha
}

// Fetch repository tree
async function fetchRepoTree(owner, repo, sha, token) {
	const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`
	const headers = {
		Accept: 'application/vnd.github+json',
	}
	if (token) {
		headers['Authorization'] = `token ${token}`
	}
	const response = await fetch(url, { headers })
	if (!response.ok) {
		handleFetchError(response)
	}
	const data = await response.json()
	return data.tree
}

// Handle fetch errors
function handleFetchError(response) {
	if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
		throw new Error(
			'GitHub API rate limit exceeded. Please try again later or provide a valid access token to increase your rate limit.'
		)
	}
	if (response.status === 404) {
		throw new Error(
			'Repository, wiki, or path not found. Please check that the URL and permissions are correct.'
		)
	}
	if (response.status === 401) {
		throw new Error(
			"Authentication failed. Please check your access token if you're trying to access private content."
		)
	}
	throw new Error(
		`Failed to fetch repository data. Status: ${response.status}. Please check your input and try again.`
	)
}

// Fetch contents of selected files
async function fetchFileContents(files, token) {
	const headers = {
		Accept: 'application/vnd.github.v3.raw',
	}
	if (token) {
		headers['Authorization'] = `token ${token}`
	}

	const contents = await Promise.all(
		files.map(async (file) => {
			const response = await fetch(file.url, { headers })
			if (!response.ok) {
				handleFetchError(response)
			}
			const text = await response.text()
			return { url: file.url, path: file.path, text }
		})
	)
	return contents
}

// Create and download zip file
async function createAndDownloadZip(fileContents) {
	const zip = new JSZip()

	fileContents.forEach((file) => {
		// Remove leading slash if present
		const filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path
		zip.file(filePath, file.text)
	})

	const content = await zip.generateAsync({ type: 'blob' })
	const url = URL.createObjectURL(content)
	const a = document.createElement('a')
	a.href = url
	a.download = 'partial_repo.zip'
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)
}

// Add these near the top with other state variables
let hiddenExtensions = new Set()
let allFiles = [] // Add this to store all files

// Add this function with the other utility functions
function getFileExtension(filename) {
	return filename.split('.').pop().toLowerCase()
}

// Add this new function
function updateHiddenExtensions(extensionString) {
	hiddenExtensions = new Set(
		extensionString
			.split(',')
			.map((ext) => ext.trim().toLowerCase())
			.filter((ext) => ext)
	)
	updateDisplayedFiles()
}

// Modify the updateDisplayedFiles function
function updateDisplayedFiles() {
	// First filter out hidden extensions
	const visibleFiles = allFiles.filter((file) => {
		const extension = getFileExtension(file.path)
		return !hiddenExtensions.has(extension)
	})

	// Update the extension checkboxes visibility
	const checkboxes = document.getElementById('extentionCheckboxes').querySelectorAll('label')
	checkboxes.forEach((label) => {
		const input = label.querySelector('input')
		if (input) {
			const ext = input.getAttribute('data-extension')
			if (ext) {
				label.style.display = hiddenExtensions.has(ext) ? 'none' : 'inline-flex'
			}
		}
	})

	// Update the directory structure display
	const directoryStructure = document.getElementById('directoryStructure')
	directoryStructure.innerHTML = generateTreeHTML(visibleFiles)

	// Reinitialize Lucide icons
	initializeLucide()
}

// Helper function to generate tree HTML (you may already have this)
function generateTreeHTML(files) {
	// Your existing tree HTML generation code
	// This should match your current implementation
}

// Add this in your initialization code (where you set up other event listeners)
document.getElementById('hideExtensions').addEventListener('input', (e) => {
	updateHiddenExtensions(e.target.value)
})

export { initializeLucide, parseRepoUrl, getReferences, updateInfoIcon, setupShowMoreInfoButton }
