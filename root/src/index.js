import * as api from '../../api'
import * as moment from "moment"

const BRAND_NAME = "Yawde"

api.postLogin = () => {
	createTree()
}

function getFilename (path) {
	const s = path.split("/")
	return s[s.length - 1]
}

let lastPath

async function createTree (supressAnimation) {
	console.log("Refreshing tree...", supressAnimation)

	// Fix location
	if (!location.hash) location.hash = "#/"
	if (location.hash.lastIndexOf("/") !== location.hash.length - 1) location.hash += "/"

	const timeout = setTimeout(() => {
		document.body.classList.add("load")
	}, 150) // add load class if this takes longer than 150ms

	const $tree = document.querySelector("#template-tree").content.cloneNode(true)

	// Add view options
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

			document.body.dataset.view = localStorage.view = this.dataset.value
		})
	})

	const $fileContainer = $tree.querySelector(".tree__files")

	const path = location.hash.replace("#", "")

	document.head.querySelector("title").innerText = path + " | " + BRAND_NAME

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

	dir.dirs.forEach(subdir => {
		const $b = document.createElement("button")
		$b.className = "tree__dir tree__item"
		$b.innerHTML = generateItemHTML(subdir)
		$b.type = "button"
		$b.dataset.path = subdir
		$b.addEventListener("click", () => {
			location.hash = $b.dataset.path + "/"
		})
		$fileContainer.appendChild($b)
	})

	dir.files.forEach(file => {
		const $a = document.createElement("a")
		$a.href = "/edit?" + file
		$a.target = "_blank"
		$a.innerHTML = generateItemHTML(file)
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
		createTree(true)
	})

	document.querySelector("#trees").appendChild($tree)

	const $alltrees = document.querySelectorAll(".tree")

	// clean up trees
	if ($alltrees.length > 2) {
		$alltrees[0].remove()
	}

	if (!supressAnimation) {
		if (lastPath && lastPath.split("/").length > path.split("/").length) {
			$alltrees[$alltrees.length - 1].classList.add("tree--backwards")
		} else {
			$alltrees[$alltrees.length - 1].classList.add("tree--forwards")
		}
	}

	lastPath = path

	document.body.classList.remove("load")
	clearTimeout(timeout)
}

// TODO: this is quite network heavy, maybe don't do this?
window.addEventListener("focus", () => {
	// recreate the tree if we regain focus
	createTree(true)
})

// create tree on page load
createTree()

window.addEventListener("hashchange", () => createTree())
