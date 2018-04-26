import * as monaco from 'monaco-editor'
import * as api from '../api'

const BRAND_NAME = "Etch"
const CHANGE_BULLET = "• "

// Setup editor environment
self.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		if (label === 'json') {
			return './json.worker.bundle.js'
		}
		if (label === 'css') {
			return './css.worker.bundle.js'
		}
		if (label === 'html') {
			return './html.worker.bundle.js'
		}
		if (label === 'typescript' || label === 'javascript') {
			return './ts.worker.bundle.js'
		}
		return './editor.worker.bundle.js'
	}
}

function getDirectoryFromPath (path) {
	const s = path.split("/")
	return s.filter((v, i) => i < s.length - 1).join("/") + "/"
}

function getFileNameFromPath (path) {
	const s = path.split("/")
	return s[s.length - 1]
}

function getFileExtensionFromPath (path) {
	const s = path.split(".")
	return "." + s[s.length - 1]
}

function setStatus (status) {
	const $status = document.querySelector("#status-text")
	$status.innerText = status
	$status.setAttribute("title", status)
	$status.classList.add("status-text--attention")
	setTimeout(() => {
		$status.classList.remove("status-text--attention")
	}, 3000)
}

function sleep (t) {
	return new Promise(resolve => {
		setTimeout(() => resolve(), t)
	})
}

async function progress (callback) {
	document.body.querySelector("#loading").removeAttribute("hidden")
	await callback()
	document.body.querySelector("#loading").setAttribute("hidden", "true")
}

//document.querySelector("#action-save").addEventListener("click", save)

async function loadEditor () {
	const path = location.search.replace("?", "")
	const extension = getFileExtensionFromPath(path)

	document.querySelector(".actions__button--open").href = "/#" + getDirectoryFromPath(path)

	let text
	let saveLock = false
	function save () {
		if (saveLock) return
		saveLock = true
		console.log("Attempting to save...")
		progress(async () => {
			try {
				const t = performance.now()

				text = editor.getValue()

				await api("fs", "put", {
					path,
					text,
				})

				setStatus(`File saved in ${Math.ceil(performance.now() - t)}ms`)

				if (document.head.querySelector("title").innerText.includes(CHANGE_BULLET)) {
					document.head.querySelector("title").innerText = document.head.querySelector("title").innerText.replace(CHANGE_BULLET, "")
					window.onbeforeunload = null
				}

				console.log("Saved!")
				saveLock = false
			} catch (ex) {
				alert("Failed to save the file. See the console for more information.")
				saveLock = false
				throw ex
			}
		})
	}

	document.querySelector("#action-save").addEventListener("click", save)

	//const path = location.search.replace("?", "")
	document.head.querySelector("title").innerText = `${getFileNameFromPath(path)} (${path}) | ${BRAND_NAME}`

	document.addEventListener("keydown", event => {
		if (event.key === "s" && event.ctrlKey) {
			save()
			event.preventDefault()
		}
	})

	try {
		text = (await api("fs", "get", {
			path
		})).text
	} catch (ex) {
		if (ex.status === 404) {
			// Handle 404 errors
			setStatus("The requested file doesn't exist. It'll be created on save.")
		} else {
			throw ex
		}
	}
	// Set up the language selector
	const $select = document.querySelector("#lang")
	const langs = monaco.languages.getLanguages()

	// Change the language
	$select.addEventListener("change", (event) => {
		monaco.editor.setModelLanguage(editor.getModel(), langs[$select.selectedIndex].id)
	})

	let initialSelectedLanguage

	langs.forEach((lang, index) => {
		// create the option for the select
		const $option = document.createElement("option")
		$option.id = lang.id
		$option.innerHTML = lang.aliases[0] || lang.id
		$select.appendChild($option)

		// Select this language
		if (lang.extensions.includes(extension)) {
			console.log("Detected as", lang.id)
			$select.selectedIndex = index
			initialSelectedLanguage = lang.id
		}
	})

	const editor = monaco.editor.create(document.getElementById('editor'), {
		// FUTURE: read this config from somewhere
		value: text,
		fontFamily: 'Hack, monospace',
		fontSize: 10,
		language: initialSelectedLanguage,
		renderWhitespace: "all",
		wordWrap: "on",
	})
	window.editor = editor

	window.addEventListener("resize", () => editor.layout())

	window.addEventListener("focus", async () => {
		const filesystemText = (await api("fs", "get", {
			path: location.search.replace("?", "")
		})).text

		if (filesystemText === text) {
			console.log("FS matches last loaded contents")
			return
		}

		if (confirm("The file has changed on disk. Discard your changes and reload the file from the disk?")) {
			editor.setValue(filesystemText)
		}

		// only show this message once
		text = filesystemText
	})

	document.body.querySelector("#loading").setAttribute("hidden", "true")

	editor.onDidChangeModelContent(() => {
		if (!document.head.querySelector("title").innerText.includes(CHANGE_BULLET)) {
			document.head.querySelector("title").innerText = CHANGE_BULLET + document.head.querySelector("title").innerText
			window.onbeforeunload = () => "You may have unsaved changes."
		}
	})
}

// Load the editor
loadEditor()
 
// Try and load the editor on login
api.postLogin = function postLogin () {
	loadEditor()
}
