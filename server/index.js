// server/index.js
import Fastify from 'fastify'
import cors from '@fastify/cors'
import simpleGit from 'simple-git'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Initialize Fastify with logger enabled
const fastify = Fastify({
	logger: true,
})

// Register CORS plugin
await fastify.register(cors, {
	origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Vite's default port
	methods: ['GET', 'POST'],
	allowedHeaders: ['Content-Type', 'Authorization'],
})

// Ensure repos directory exists
const reposDir = path.join(__dirname, 'repos')
try {
	await fs.access(reposDir)
} catch {
	await fs.mkdir(reposDir)
}

// Route to clone/update wiki repository
fastify.post('/clone-wiki', async (request, reply) => {
	const { repoUrl } = request.body

	if (!repoUrl) {
		return reply.status(400).send({ error: 'Missing repoUrl in request body' })
	}

	// Extract owner and repo name
	const regex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.wiki)?(\.git)?$/
	const match = repoUrl.match(regex)
	if (!match) {
		return reply.status(400).send({ error: 'Invalid GitHub repository URL format' })
	}

	const owner = match[1]
	const repo = match[2]
	const wikiRepoUrl = `https://github.com/${owner}/${repo}.wiki.git`
	const cloneDir = path.join(reposDir, `${owner}-${repo}-wiki`)

	try {
		// Check if repository exists
		try {
			await fs.access(cloneDir)
			// If exists, pull latest changes
			const git = simpleGit(cloneDir)
			await git.pull()
			return { message: 'Wiki repository updated successfully' }
		} catch {
			// If not exists, clone it
			const git = simpleGit()
			await git.clone(wikiRepoUrl, cloneDir)
			return { message: 'Wiki repository cloned successfully' }
		}
	} catch (error) {
		fastify.log.error(error)
		return reply.status(500).send({
			error: 'Failed to clone/update wiki repository',
			details: error.message,
		})
	}
})

// Route to list wiki pages
fastify.get('/wiki-pages', async (request, reply) => {
	const { repoUrl } = request.query

	if (!repoUrl) {
		return reply.status(400).send({ error: 'Missing repoUrl query parameter' })
	}

	const regex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.wiki)?(\.git)?$/
	const match = repoUrl.match(regex)
	if (!match) {
		return reply.status(400).send({ error: 'Invalid GitHub repository URL format' })
	}

	const owner = match[1]
	const repo = match[2]
	const cloneDir = path.join(reposDir, `${owner}-${repo}-wiki`)

	try {
		await fs.access(cloneDir)
		const files = await fs.readdir(cloneDir)
		const mdFiles = files.filter((file) => file.endsWith('.md'))
		return { pages: mdFiles }
	} catch (error) {
		fastify.log.error(error)
		return reply.status(404).send({
			error: 'Wiki repository not found or not accessible',
			details: error.message,
		})
	}
})

// Route to get wiki page content
fastify.get('/wiki-pages/:pageName', async (request, reply) => {
	const { repoUrl } = request.query
	const { pageName } = request.params

	if (!repoUrl || !pageName) {
		return reply.status(400).send({
			error: 'Missing repoUrl query parameter or pageName path parameter',
		})
	}

	const regex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.wiki)?(\.git)?$/
	const match = repoUrl.match(regex)
	if (!match) {
		return reply.status(400).send({ error: 'Invalid GitHub repository URL format' })
	}

	const owner = match[1]
	const repo = match[2]
	const cloneDir = path.join(reposDir, `${owner}-${repo}-wiki`)
	const filePath = path.join(cloneDir, pageName)

	try {
		await fs.access(filePath)
		const content = await fs.readFile(filePath, 'utf8')
		return { content }
	} catch (error) {
		fastify.log.error(error)
		return reply.status(404).send({
			error: 'Wiki page not found or not accessible',
			details: error.message,
		})
	}
})

// Start the server
const start = async () => {
	try {
		const port = process.env.PORT || 3000
		await fastify.listen({ port, host: '0.0.0.0' })
		fastify.log.info(`Server listening on port ${port}`)
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}

start()
