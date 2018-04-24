# Etch 
## Yet another cloud IDE

Etch is a Javascript-based IDE inspired by Cloud9 and other similar solutions. It was created out of a need for a lightweight self-hosted web editor with Typescript support. Etch uses Microsoft's Monaco editor (the same editor that's used in VSCode) which provides support for many languages and performs very well.

### Features

* Integrated terminal with persistent sessions
* Supports many programming languages
* Lightweight design
* Single-user authentication

### Planned funtionality

* Improve the file browser
    * Add folder creation
    * Add drag/drop support for copying & moving files
* Error handling
* Soft/hard tab option in the editor
* Ability to open the editor from the terminal
* User configuration for editor
* Improve Typescript support with imported types
* Use UNIX sockets instead of port numbers for Hapi and GoTTY
* Browser icons for editor and file browser
* Links to file browser and terminal from the editor
* Easily installable image, such as a Docker or Snap image
* Plugin support

### Tab-less design

Etch creates editors in browser tabs rather than having a tabbing system of it's own. All modern browsers have been designed and optimised for many tabs, it doesn't make sense to me to reimplement an existing technology at the expense of screen real-estate and time. This makes Etch load very quickly in comparison to Cloud9 and alternatives, as well as being able to leverage browser features such as history, tab restoration, tab search, bookmarks, etc.

Because Etch works by creating new tabs, you'll want to whitelist it in your browsers popup blocker.

### Limitations

Etch is designed to be used by one user at a time over HTTPS. Multiple users are not supported. When the user logs in, the previous authentication token is invalidated immediately and all terminal sessions are closed.

Etch does not directly implement any form of HTTPS, however **HTTPS is strongly recommended as authentication is otherwise sent over plaintext**. Use some TLS reverse proxy solution like [slt](https://github.com/inconshreveable/slt).

Terminal tabs created by Etch are not bookmarkable as their URL changes over time due to the way Etch implements GoTTY. Editors and file explorers can be bookmarked. I'd like to revist this implementation in the future and attempt to improve it, but it works well enough without changing the source of GoTTY or using any hacks.

### Installation

1. Clone this git repo `git clone https://github.com/benjamingwynn/etch.git && cd etch`
2. Install [tmux](https://en.wikipedia.org/wiki/Tmux) via your system package manager. This is required for browser terminal support. You'll also need to install [node.js](https://nodejs.org).
3. Run `npm run setup` - this will download GoTTY from Github and install npm deps. This only works on Linux x64 systems. Other systems will have to download the GoTTY image manually.
4. Build etch with `npm run build`
5. Run the etch server with node.js: `node index.js`

### Configuration

Etch is configurable via the `config.json` file.

`workspace_dir` - directory to show by default to the user
`host` - host to serve the server on
`port_gotty` - port to start serving gotty requests on - note that gotty is served on any port **AFTER** this port. For example, if you enter `8001` GoTTY may serve at `8001`, `8002` and/or any number equal to or greater than `8001`. Probably don't change this.
`port_hapi` - port to start serving hapi on. Probably don't change this.
`port_proxy` - port to start serving the http proxy server on. **This should be the port you direct your clients to**
`auth_username` - The username in plaintext required to access the system.
`auth_password` - The password in plaintext required to access the system.

### Browser support

Etch makes use of modern Javascript API's such as `fetch`, `await/async`, `localStorage` and Promises. Because of this, it's only supported in modern browsers. Etch does not work in Internet Explorer. Etch has been tested working in the latest versions of Firefox and Chromium.
