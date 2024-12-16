// vite.config.js
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
	build: {
		outDir: 'dist',
		rollupOptions: {
			input: {
				main: path.resolve(__dirname, 'index.html'),
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@components': path.resolve(__dirname, './src/components'),
			'@services': path.resolve(__dirname, './src/js'),
			'@utils': path.resolve(__dirname, './src/utils'),
		},
	},
})
