import * as api from '../../api'
import * as moment from "moment"

const BRAND_NAME = "Yawde"

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
		$a.className = "tree__file tree__item"
		$fileContainer.appendChild($a)
	})

	dir.special.forEach(file => {
		const $b = document.createElement("button")
		$b.innerHTML = generateItemHTML(file)
		$b.type = "button"
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

	return $treeWrapper
}

async function refreshMain (supressAnimation) {
	console.log("Refreshing tree...", supressAnimation)

	// Fix location
	// BUG: fixing location like this traps navigation
	if (!location.hash) location.hash = "#/"
	if (location.hash.lastIndexOf("/") !== location.hash.length - 1) location.hash += "/"

	const timeout = setTimeout(() => {
		document.body.classList.add("load")
	}, 150) // add load class if this takes longer than 150ms

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

	document.body.classList.remove("load")
	clearTimeout(timeout)
}

// TODO: this is quite network heavy, maybe don't do this?
window.addEventListener("focus", () => {
	// recreate the tree if we regain focus
	// refreshMain(true)
})

refreshMain()

window.addEventListener("hashchange", () => refreshMain())
