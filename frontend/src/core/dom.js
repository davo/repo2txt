import { init, classModule, propsModule, styleModule, eventListenersModule, h } from 'snabbdom'

// Initialize Snabbdom with required modules
export const patch = init([classModule, propsModule, styleModule, eventListenersModule])

// Component factory
export function createComponent(render, initialState = {}) {
	let state = initialState
	let vnode = null
	let element = null
	let hooks = {}

	const component = {
		setHooks(newHooks) {
			hooks = newHooks
			return component
		},

		mount(container) {
			hooks.beforeMount?.(state)
			vnode = render(state)
			element = patch(container, vnode)
			hooks.afterMount?.(element, state)
			return element
		},

		update(newState) {
			state = { ...state, ...newState }
			const newVnode = render(state)
			vnode = patch(vnode, newVnode)
		},

		destroy() {
			if (element) {
				patch(vnode, h('!'))
			}
		},
	}

	return component
}

// Simple state management
export class Store {
	constructor(initialState = {}) {
		this.state = initialState
		this.listeners = new Set()
	}

	subscribe(listener) {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	setState(partial) {
		this.state = { ...this.state, ...partial }
		this.notify()
	}

	notify() {
		this.listeners.forEach((listener) => listener(this.state))
	}
}

// Event handling utility
export function createEventHandler(handlers) {
	return {
		on: Object.entries(handlers).reduce((acc, [event, handler]) => {
			acc[event] = (e) => handler(e)
			return acc
		}, {}),
	}
}
