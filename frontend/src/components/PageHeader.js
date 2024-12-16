import { h } from 'snabbdom'
import { createComponent } from '../core/dom.js'

export function createPageHeader({ title, subtitle }) {
	const render = (state) => {
		return h('div.header-container', [
			// GitHub link
			h(
				'a',
				{
					props: {
						href: 'https://github.com/abinthomasonline/repo2txt',
						target: '_blank',
					},
					class: {
						absolute: true,
						'top-2': true,
						'right-2': true,
					},
				},
				[
					h('i', {
						class: {
							'w-8': true,
							'h-8': true,
							'text-gray-600': true,
							'hover:text-gray-800': true,
						},
						dataset: {
							lucide: 'github',
						},
					}),
				]
			),
			// Title
			h(
				'h1',
				{
					class: {
						'text-3xl': true,
						'font-bold': true,
						'mb-2': true,
						'text-center': true,
						'text-gray-600': true,
					},
				},
				state.title
			),
			// Subtitle
			h(
				'p',
				{
					class: {
						'text-lg': true,
						'text-center': true,
						'text-gray-500': true,
						'mb-6': true,
					},
				},
				state.subtitle
			),
		])
	}

	return createComponent(render, { title, subtitle })
}
