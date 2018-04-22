const API_ENDPOINT = "/api/"

/** Editor API interface. Accepts and spits out JSON */
let api
module.exports = api = async function api (apiClass, apiFunction, data) {
	if (!data) data = {}

	const d = await (fetch(`${API_ENDPOINT}${apiClass}/${apiFunction}`, {
		method: "POST",
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(Object.assign(data, {
			auth: localStorage.auth || "auth property not set"
		}))
	}))

	if (!d.ok) {
		try {
			console.error(await d.json())
		} catch (ex) {}

		if (d.status === 401) {
			console.warn("Unauthorised. Showing login form.")
			document.querySelector("#login").removeAttribute("hidden")
		}

		throw d
	}

	const json = await d.json()

	return json
}

/** Setup the login form */

document.body.innerHTML += `
	<main id="login" hidden>
		<style>
			#login {
				position: fixed;
				background: rgba(0,0,0,0.9);
				justify-content: center;
				z-index: 1;
				display: flex;
				flex-flow: column nowrap;
				width: 100%;
				height: 100%;
				top: 0;
			}

			#login[hidden] {
				display: none;
			}

			#login-form {
				background: white;
				margin: auto;
				padding: 1em;
			}
		</style>

		<form id="login-form">
			<h1>Authenticate</h1>
			<p>You are not logged in, your login session timed out, or you logged in somewhere else.</p>

			<input placeholder="Username" id="username" type="text" />
			<input placeholder="Password" id="password" type="password" />
			<button type="submit">Login</button>
		</form>
	</main>
`

document.querySelector("#login-form").addEventListener("submit", async event => {
	event.preventDefault()

	const result = await api("auth", "login", {
		username: document.querySelector("#username").value,
		password: document.querySelector("#password").value,
	})

	console.log(result)

	localStorage.auth = result.authorisedToken

	document.querySelector("#login").setAttribute("hidden", "true")

	if (api.postLogin) api.postLogin()
})
