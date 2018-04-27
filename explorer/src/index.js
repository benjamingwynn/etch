import * as api from '../../api'
import * as moment from "moment"

const BRAND_NAME = "Etch"

api.postLogin = () => {
	refreshMain()
}

function getFilename (path) {
	const s = path.split("/")
	return s[s.length - 1]
}

let lastPath

/** Generate the tree, but don't set it as the current tree */
async function generateTree (path, minimal) {
	const timeout = setTimeout(() => {
		document.body.classList.add("load")
	}, 150) // add load class if this takes longer than 150ms

	const $tree = document.querySelector("#template-tree").content.cloneNode(true)
	console.log("Generating tree for", path, minimal)

	// Add view options
	if (minimal) {
		// Hide stuff other than the tree
		$tree.querySelector(".tree__options").setAttribute("hidden", "true")
		$tree.querySelector(".tree__path").setAttribute("hidden", "true")
	} else {
		if (localStorage.view) {
			document.body.dataset.view = localStorage.view
			const $d = $tree.querySelector(`.setting[data-value='${localStorage.view}']`)
			$d.classList.add("setting--active")
		} else {
			const $d = $tree.querySelector(".setting[data-default]")
			console.log($d)
			$d.classList.add("setting--active")
			document.body.dataset.view = localStorage.view = $d.dataset.value
		}

		$tree.querySelectorAll(".setting").forEach($setting => {
			$setting.addEventListener("click", function () {
				this.parentElement.querySelector(".setting--active").classList.remove("setting--active")
				this.classList.add("setting--active")

				// let refresh = false
				// if (this.dataset.value === "tree" || document.body.dataset.view === "tree" ) refresh = true
				document.body.dataset.view = localStorage.view = this.dataset.value
				// if (refresh) refreshMain(true)
			})
		})

		const $pp = $tree.querySelector(".tree__path")
		const pathsplit = path.split("/")

		let builtPath = ""
		pathsplit.forEach((pathbit, i) => {
			if (i === pathsplit.length - 1) return

			const $p = document.createElement("button")

			$p.innerHTML = pathbit + "/"
			$p.className = "tree__path__button"
			builtPath += $p.innerHTML
			$p.dataset.path = builtPath

			$p.addEventListener("click", () => {
				location.hash = $p.dataset.path
			})

			$pp.appendChild($p)
		})
	}

	const dir = await api("fs", "ls", {
		path
	})

	function generateItemHTML (p) {
		const name = getFilename(p)

		// query the api for the modified time
		api("fs", "stat", {path: p}).then((stat) => {
			const $$i = document.querySelectorAll(`.tree__item[data-path="${p}"] .tree__item__mod`)
			$$i.forEach($i => {
				$i.innerText = moment(stat.mtime).fromNow()
				$i.title = stat.mtime
			})
		})

		return `
			<div class="tree__item__name">${name}</div>
			<div class="tree__item__mod"></div>
		`
	}

	const $fileContainer = $tree.querySelector(".tree__files")

	dir.dirs.forEach(subdir => {
		const $b = document.createElement("button")

		// add tree expand button if this is tree view
		// if (document.body.dataset.view === "tree") {
		const $expandButton = document.createElement("div")
		$expandButton.className = "tree__item__expander"
		$b.appendChild($expandButton)
		// }

		$b.className = "tree__dir tree__item"
		$b.innerHTML += generateItemHTML(subdir)
		$b.type = "button"
		$b.dataset.path = subdir
		$b.dataset.type = "dir"
		$b.addEventListener("click", async function () {
			if (document.body.dataset.view === "tree") {
				if (this.classList.contains("tree__dir--expanded")) {
					console.log("collapse!")
					this.classList.remove("tree__dir--expanded")
					this.nextSibling.remove() // TODO: animation
				} else {
					console.log("expand!")
					this.classList.add("tree__dir--expanded")

					// create a sub tree
					const $subtree = await generateTree(this.dataset.path + "/", true)
					$subtree.classList.add("tree__item__subtree")
					$subtree.classList.add("tree-wrapper--inline")
					
					// insert the subtree
					this.parentNode.insertBefore($subtree, this.nextSibling)
				}
				// TODO: Create the tree inline
			} else {
				location.hash = $b.dataset.path + "/"
			}
		})

		$fileContainer.appendChild($b)
	})

	dir.files.forEach(file => {
		const $a = document.createElement("a")
		$a.href = "/edit?" + file
		$a.target = "_blank"
		$a.innerHTML += generateItemHTML(file)
		$a.dataset.path = file
		$a.dataset.type = "file"
		$a.className = "tree__file tree__item"
		$fileContainer.appendChild($a)
	})

	dir.special.forEach(file => {
		const $b = document.createElement("button")
		$b.innerHTML = generateItemHTML(file)
		$b.type = "button"
		$b.dataset.path = file
		$b.dataset.type = "special"
		$b.className = "tree__special tree__item"
		$b.addEventListener("click", async () => {
			// open the terminal
			console.log("opening the terminal")
			const result = await api("terminal", "connect", {path})
			window.open(result.url + localStorage.auth + "/")
		})
		$fileContainer.appendChild($b)
	})

	$tree.querySelector(".action--new-file").addEventListener("click", () => {
		const name = prompt("Create a new file with the name...", "untitled.txt")

		if (name) {
			window.open(`/edit?${lastPath}${name}`)
		}
	})

	$tree.querySelector(".action--terminal").addEventListener("click", async () => {
		const result = await api("terminal", "connect", {path})
		window.open(result.url + localStorage.auth + "/")
	})

	$tree.querySelector(".action--refresh").addEventListener("click", () => {
		refreshMain(true)
	})

	const $treeWrapper = document.createElement("div")
	$treeWrapper.appendChild($tree)
	$treeWrapper.className = "tree-wrapper"

	clearTimeout(timeout)
	document.body.classList.remove("load")

	return $treeWrapper
}

async function refreshMain (supressAnimation) {
	console.log("Refreshing tree...", supressAnimation)

	// Fix location
	// BUG: fixing location like this traps navigation
	if (!location.hash) location.hash = "#/"
	if (location.hash.lastIndexOf("/") !== location.hash.length - 1) location.hash += "/"


	const path = location.hash.replace("#", "")
	const $tree = await generateTree(path)
	$tree.classList.add("tree-wrapper--independant")

	document.head.querySelector("title").innerText = path + " | " + BRAND_NAME

	document.querySelector("#trees").appendChild($tree)

	const $treeWrappers = document.querySelectorAll(".tree-wrapper.tree-wrapper--independant")
	const $trees = document.querySelectorAll(".tree-wrapper.tree-wrapper--independant .tree")

	// clean up trees
	if ($treeWrappers.length > 2) {
		$treeWrappers[0].remove()
	}

	if (!supressAnimation) {
		if (lastPath && lastPath.split("/").length > path.split("/").length) {
			$trees[$trees.length - 1].classList.add("tree--backwards")
		} else {
			$trees[$trees.length - 1].classList.add("tree--forwards")
		}
	}

	lastPath = path
}

// add context menu actions
let cursorX, cursorY, $contextMenuTarget
const $menu = document.querySelector(".context-menu")
const $shade = document.querySelector(".context-shade")

function hideContextShade () {
	document.querySelector(".context-focus").classList.remove("context-focus")
	$shade.setAttribute("hidden", "true")
}

$shade.addEventListener("mousedown", (event) => {
	if (event.target !== $shade) return // direct only
	hideContextShade()
})

window.addEventListener("contextmenu", (event) => {
	event.preventDefault()

	console.log(event)

	let $tar = event.target

	while ($tar !== document.body) {
		console.log($tar)

		if ($tar.classList && $tar.classList.contains("tree__item")) {
			$shade.removeAttribute("hidden")
			console.log($menu, cursorX, cursorY)
			$menu.style.top = cursorY + "px"
			$menu.style.left = cursorX + "px"
			$contextMenuTarget = $tar
			$menu.dataset.path = $tar.dataset.path
			$menu.dataset.type = $tar.dataset.type
			$menu.dataset.friendly = $tar.querySelector(".tree__item__name").innerText
			$tar.classList.add("context-focus")

			const rect = $menu.getBoundingClientRect()

			if (rect.right > window.innerWidth) {
				$menu.style.left = (window.innerWidth - rect.width) + "px"
			}

			if (rect.bottom > window.innerHeight) {
				$menu.style.top = (window.innerHeight - rect.height) + "px"
			}

			break
		}

		$tar = $tar.parentNode
	}
})
document.querySelector(".context-menu__item--here").addEventListener("click", () => {
	window.location = $contextMenuTarget.href
})

document.querySelector(".context-menu__item--popout").addEventListener("click", () => {
	window.open("/#" + $menu.dataset.path)
	hideContextShade()
})

document.querySelector(".context-menu__item--remove").addEventListener("click", async () => {
	const isSpecial = $menu.dataset.type === "special"
	const confirmed = confirm(isSpecial ? "Removing a tmux socket will disconnect any connected terminals and kill any running processes.\n\nDestroy this tmux socket?" : `You are about to delete a file/folder from the filesystem. This action is irreversible.\n\nDelete ${$menu.dataset.friendly}?`)

	if (confirmed) {
		await api("fs", "rm", {path: $menu.dataset.path})
		document.querySelector(".tree__item[data-path='" + $menu.dataset.path + "']").classList.add("tree__item--removed")
	}

	hideContextShade()
})

document.querySelector(".context-menu__item--rename").addEventListener("click", async () => {
	const filename = prompt("Enter the new name for the file/folder:")
	if (!filename) {
		hideContextShade()
		return
	}

	await api("fs", "rename", {path: $menu.dataset.path, filename})
	hideContextShade()

	// HACK: just refresh the main tree right now. dynamically processing the rename would be too complicated with trees
	refreshMain()
})

document.addEventListener("mousemove", (event) => {
	cursorX = event.clientX
	cursorY = event.clientY
})

window.addEventListener("keyup", event => {
	if (event.key === "Escape") hideContextShade()
})

refreshMain()

window.addEventListener("hashchange", () => refreshMain())
