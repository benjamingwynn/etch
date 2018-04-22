"use strict"
const BRAND_NAME = "Etch"

/*
	External dependancies: tmux, gotty
*/

const Hapi = require("hapi") // Hapi 17
const http = require("http")
const Proxy = require("http-proxy")
const boom = require("boom")
const crypto = require("crypto")
const path = require("path")
const fs = require("fs-extra")
const childProc = require("child_process")

const config = fs.readJsonSync("./config.json")

// TODO: verify configuration

// Hapi Sever config
const server = Hapi.server({
	host: config.host,
	port: config.port_hapi,
})

// Global variables
let authorisedToken = ""
const gottyRegisteredPorts = {}
// let gotty

/*
	Setup the proxy
*/

const proxy = Proxy.createProxyServer({
	ws: true
})

function proxyHandler (req, res, terminalCallback, otherCallback) {
	const split = req.url.split("/")

	if (split[1] === "terminal") {
		// Check port
		const requestTerminalPort = split[2]
		const requestAuthToken = split[3]

		if (requestTerminalPort && requestAuthToken) {
			if (!authorisedToken || requestAuthToken !== authorisedToken) {
				if (res.writeHead) {
					res.writeHead(403)
					res.write("Your authentication token is missing or invalid. Use the file explorer to log back in.")
					res.end()
					return
				}
			}

			if (gottyRegisteredPorts[requestTerminalPort]) {
				req.url = req.url.replace(`/terminal/${requestTerminalPort}/${requestAuthToken}`, "") // remove extra stuff from url
				terminalCallback(requestTerminalPort)
			} else {
				if (res.writeHead) {
					res.writeHead(410)
					res.write("The terminal at this address has been closed. Use the file explorer to re-open it.")
					res.end()
				}
			}

			return
		}
	}

	otherCallback()
}

const proxyServer = http.createServer(function (req, res) {
	proxyHandler(req, res, (requestTerminalPort) => {
		proxy.web(req, res, { target: `http://localhost:${requestTerminalPort}` })
	}, () => {
		proxy.web(req, res, { target: `http://localhost:${config.port_hapi}` })
	})
})

proxyServer.on('upgrade', function (req, socket, head) {
	console.log("Request wants to be upgraded", req.url)
	proxyHandler(req, socket, (requestTerminalPort) => {
		proxy.ws(req, socket, {target: `ws://localhost:${requestTerminalPort}`})
	}, () => {
		// FUTURE: insert websocket handlers if we need them
	})
})

proxyServer.listen(config.port_proxy)

function getPath (path) {
	return config.workspace_dir + path
}

function destroyRegisteredGottyPorts () {
	Object.keys(gottyRegisteredPorts).forEach(portNumber => {
		console.log("Destroying Gotty at port", portNumber)
		gottyRegisteredPorts[portNumber].kill()
		console.log("Unregistering...")
		delete gottyRegisteredPorts[portNumber]
	})
}

function doesTmuxSocketHaveSession (socketPath) {
	return new Promise ((resolve, reject) => {
		childProc.exec(`tmux -S ${socketPath} has-session`, null, (error, stdin, stdout) => {
			if (error) {
				if (error.code === 1) {
					resolve(false)
				} else {
					reject(error)
				}
			} else {
				resolve(true)
			}
		})
	})
}

async function startTerminal (dir) {
	const socketPath = ".tmux-socket"
	const workingDirectory = getPath(dir)
	const socketAbsPath = path.resolve(workingDirectory + "/" + socketPath)
	const socketExists = await fs.exists(socketAbsPath)

	let port = parseInt(config.port_gotty)

	const options = {
		cwd: workingDirectory,
		env: process.env,
	}

	// keep adding 1 until we've found an unregistered port
	while (gottyRegisteredPorts[port]) port += 1

	console.log(gottyRegisteredPorts)

	const tmuxOption = socketExists && await doesTmuxSocketHaveSession(socketAbsPath) ? "attach-session" : "new-session"

	const gotty = childProc.spawn("gotty", [
		// https://github.com/yudai/gotty#options
		"--once",
		`--address`,
		config.host,
		`--port`,
		port,
		"-w",
		"--title-format",
		`${dir} | ${BRAND_NAME}`,

		// https://www.systutorials.com/docs/linux/man/1-tmux/
		"tmux",
		"-S",
		socketPath,
		tmuxOption
	] , options)

	gottyRegisteredPorts[port] = gotty // register the port

	function gottyOut (data, callback) {
		console.log(`[gotty out] ${data}`)
	}

	gotty.stdout.on('data', gottyOut)
	gotty.stderr.on('data', gottyOut)

	gotty.on('close', (code) => {
		console.log(`[gotty exit] ${code}`)

		// unregister the port
		delete gottyRegisteredPorts[port]
	})

	return port
}

// API functions
const api = {
	terminal: {
		/** Start the terminal for the user to connect to. Returns the URL to redirect the user to */
		async connect (request) {
			// if (gotty) {
			// 	return boom.locked("A terminal instance has already been spawned. The existing instance must terminate first")
			// }

			if (!request.payload.path) return boom.badRequest("Missing payload.path")

			const port = await startTerminal(request.payload.path)

			return {
				"url": `/terminal/${port}/`
			}
		},
	},

	fs: {
		async rm (request) {
			const path = getPath(request.payload.path)
			const pathSplit = path.split("/")

			if (pathSplit[pathSplit.length - 1] === ".tmux-socket") {
				console.log("Avoiding deletion of tmux socket, for now")
				console.log("doesTmuxSocketHaveSession", doesTmuxSocketHaveSession(path))
				
				if (doesTmuxSocketHaveSession) {
					// TODO: detach sessions
				}

				return boom.notImplemented()
			}

			await fs.remove(path)

			return {}
		},

		async get (request) {
			const path = getPath(request.payload.path)

			if (await fs.exists(path)) {
				const text = (await fs.readFile(path)).toString()

				return {
					text,
				}
			} else {
				return boom.notFound()
			}
		},

		async put (request) {
			const path = getPath(request.payload.path)
			fs.outputFile(path, request.payload.text)
			return {}
		},

		async stat (request) {
			const p = getPath(request.payload.path)
			return await fs.stat(p)
		},

		async ls (request) {
			const p = getPath(request.payload.path)
			const all = await fs.readdir(p)

			const dirs = []
			const files = []
			const special = []

			for (let i = 0; i < all.length; i += 1) {
				const r = request.payload.path + all[i]

				if (all[i] === ".tmux-socket") {
					special.push(r)
					continue
				}

				if ((await fs.stat(p + all[i])).isDirectory()) {
					dirs.push(r)
				} else {
					files.push(r)
				}
			}

			return {
				dirs,
				files,
				special,
			}
		}
	},

	auth: {
		async login (request) {
			if (request.payload.username.toLowerCase() === config.auth_username && request.payload.password === config.auth_password) {
				authorisedToken = crypto.randomBytes(48).toString("hex")

				// when a new port is registered, destroy gotty ports
				destroyRegisteredGottyPorts()

				return {authorisedToken: authorisedToken}
			} else {
				return boom.unauthorized()
			}
		}
	}
}

server.route({
	method: "POST",
	path: "/api/{apiClass}/{apiFunction}",

	// DEV: allow any origin. this should be limited on release version
	options: {
		cors: true
	},

	async handler (request, h) {
		try {
			if (!request.payload.auth) {
				return boom.badRequest("Missing auth property.")
			}

			if (request.params.apiClass !== "auth" || request.params.apiFunction !== "login") { // don't fire auth logic for login api requests
				if (!authorisedToken || request.payload.auth !== authorisedToken) {
					return boom.unauthorized()
				}
			}

			const apiClass = api[request.params.apiClass]

			if (apiClass) {
				const apiFunction = apiClass[request.params.apiFunction]
				if (apiFunction) {
					return await apiFunction(request, h)
				} else {
					return boom.badRequest("API function not found")
				}
			} else {
				return boom.badRequest("API class not found")
			}
		} catch (ex) {
			console.error(ex)
			return boom.badImplementation(ex.toString())
		}
	}
})

/** Serve the editor client*/
server.route({
	method: "GET",
	path: "/edit",
	handler (request, h) {
		return h.file("editor/dist/index.html")
	}
})

/** serve the explorer */
server.route({
	method: "GET",
	path: "/explorer/{file*}",
	handler (request, h) {
		return h.file("explorer/" + request.params.file)
	}
})

server.route({
	method: "GET",
	path: "/",
	handler (request, h) {
		return h.file("explorer/index.html")
	}
})

// serve editor assets
server.route({
	method: "GET",
	path: "/{path}",
	handler (request, h) {
		const p = "editor/dist" + request.path
		return h.file(p)
	}
})

// Start the server
;(async function () {
	try {
		await server.register(require("inert")) // XXX: what does this do?
		await server.start()
	} catch (err) {
		console.log(err)
		process.exit(1)
	}
}())

/*
	Exit stuff
*/

process.stdin.resume()

function exitHandler (options, err) {
	if (options.cleanup) {
		destroyRegisteredGottyPorts()
	}

	if (err && err.stack) console.log(err.stack)
	if (options.exit) process.exit()
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
