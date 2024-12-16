/**
 * Service for handling GitHub Wiki related operations
 */
export class WikiService {
	constructor(baseUrl) {
		this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000'
	}

	/**
	 * Fetch all wiki contents including pages and their content
	 * @param {string} owner - Repository owner
	 * @param {string} repo - Repository name
	 * @param {string} token - Optional GitHub personal access token
	 * @returns {Promise<Array>} - Array of wiki pages with their content
	 */
	async fetchWikiContents(owner, repo, token = null) {
		const repoUrl = `https://github.com/${owner}/${repo}`

		// Step 1: Clone/update the wiki repository
		const cloneResponse = await fetch(`${this.baseUrl}/clone-wiki`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(token && { Authorization: `Bearer ${token}` }),
			},
			body: JSON.stringify({ repoUrl }),
		})

		if (!cloneResponse.ok) {
			throw new Error('Failed to clone wiki repository')
		}

		// Step 2: Get list of wiki pages
		const pagesResponse = await fetch(
			`${this.baseUrl}/wiki-pages?repoUrl=${encodeURIComponent(repoUrl)}`,
			{
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			}
		)

		if (!pagesResponse.ok) {
			throw new Error('Failed to fetch wiki pages')
		}

		const { pages } = await pagesResponse.json()

		// Step 3: Fetch content for each page
		const contentPromises = pages.map(async (pageName) => {
			const contentResponse = await fetch(
				`${this.baseUrl}/wiki-pages/${encodeURIComponent(pageName)}?repoUrl=${encodeURIComponent(repoUrl)}`,
				{
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				}
			)

			if (!contentResponse.ok) {
				throw new Error(`Failed to fetch content for ${pageName}`)
			}

			const { content } = await contentResponse.json()
			return {
				path: pageName,
				text: content,
			}
		})

		return Promise.all(contentPromises)
	}
}
