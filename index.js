const express = require('express')
const crypt = require("node:crypto")
const http = require('http')
const puppeteer = require('puppeteer')
const teplates = require('sprightly')
//const Tidal = require('tidalapi')
const db = require('better-sqlite3')('tidalfix.db')
const getid = db.prepare("SELECT * FROM embeds WHERE ID = ?")
const insertbad = db.prepare("INSERT INTO blacklisted (ID) VALUES (?)")
const findbad = db.prepare("SELECT * FROM blacklisted WHERE ID = ?")
const insertfound = db.prepare("INSERT INTO embeds (id, created, title, description, image) VALUES (?, strftime('%s', 'now'), ?, ?, ?)")
const getartist = db.prepare("SELECT * FROM artists WHERE id = ?")
const insertartist = db.prepare("INSERT OR IGNORE INTO ARTISTS (id, created, name, description, image) VALUES (?, strftime('%s', 'now'), ?, ?, ?)")
const findbadartist = db.prepare("SELECT * FROM artist_blacklist WHERE ID = ?")
const insertbadart = db.prepare("INSERT OR IGNORE INTO artist_blacklist (ID) VALUES (?)")
const findbadtrack = db.prepare("SELECT * FROM track_blacklist WHERE ID = ?")
const insertbadtrack = db.prepare("INSERT OR IGNORE INTO track_blacklist (ID) VALUES (?)")
const findtrack = db.prepare("SELECT * FROM tracks WHERE id = ?")
const inserttrack = db.prepare("INSERT OR IGNORE INTO tracks (id, created, title, description, image) VALUES (?, strftime('%s', 'now'), ?, ?, ?)")



// woohoo i just love writing 500 sql prepared statements...
console.log("STARTING TIDALFIX V0.3\nMADE BY ELPERSON 2022")
const app = express()

app.engine('spy', teplates)
app.set('views', './')
app.set('view engine', 'spy')


const botRegex = new RegExp(/Discordbot\/2\.0|Twitterbot\/1.0/)
const reqoptns = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.5',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
}
const port = 8080
function ValidateId(req, res, next) {
    let num = parseInt(req.params.id)
    if (Number.isInteger(num)) {
        req.params.id = num
        next()
    } else {
        res.status(400).send("ARGUMENT 'ID' MUST BE AN INTEGER")
    }
}
function ValidateBlacklist(req, res, next) {
    let dbres = findbad.get(req.params.id)
    if (!dbres) {
        next()
    } else {
        res.status(406).send("ARGUMENT 'ID' HAS BEEN BLACKLISTED")
    }
}
async function Scrape(url) {
    const page = await (await puppeteer.launch()).newPage()
    page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36")
    page.setExtraHTTPHeaders(reqoptns)
    let resp = await page.goto(url)
    if (resp.ok()) {
        let title = await page.evaluate(`document.querySelector('meta[property="og:title"]').getAttribute('content')`)
        let description = await page.evaluate(`document.querySelector('meta[property="og:description"]').getAttribute('content')`)
        let image = await page.evaluate(`document.querySelector('meta[property="og:image"]').getAttribute('content')`)
        page.close()
        return {title: title, description: description, image: image}
    }else {
        return await resp.status()
    }
    return page
}

app.use(express.static('static'))
app.use("(/browse)?/album/:id", ValidateId)
app.use("(/browse)?/artist/:id", ValidateId)
app.use("(/browse)?/track/:id", ValidateId)
app.use("(/browse)?/album/:id", ValidateBlacklist)
app.use("(/browse)?/artist/:id", async (req, res, next) => {
    if (req.params.id >= 250) { // 250 is the lowest artist id
        let dbres = await findbadartist.get(req.params.id)
        if (!dbres) {
            next()
        }else
            res.status(406)
    }else
        res.status(400)
})
app.use("(/browse)?/track/:id", async (req, res, next) => {
    let dbres = await findbadtrack.get(req.params.id)
    if (!dbres) 
        next()
    else
        res.status(406)
})
app.get('/browse/album/:id/json', async (req, res) => {
    res.json({
        "provider_name": "Listen on TIDAL",
        "provider_url": `https://tidal.com/browse/album/${req.params.id}`,
    })
    
})
app.get('/browse/artist/:id/json', async (req, res) => {
    res.json({
        provider_name: 'Listen on TIDAL',
        provider_url: `https://tidal.com/browse/artist/${req.params.id}`
    })
})

app.get('/gitPush', async (req, res) => {
    let secure = req.get('x-hub-signature-256')

    if (secure != undefined) {
        let verif = crypt.verify('SHA256', req.body, "killer  fish... killer fish from San Diego. I don't know what I am but I taste really good", secure)
        if (verif) {
            console.log('good')
        }else {
            res.status(401).send('nice try')
        }
    }else {
        res.status(400).send('missing')
    }
})

// all of the browse code could be boiled down to a single thing tbf
app.get('(/browse)?/track/:id', async (req, res) => {
    console.log("TRACK REQUESTED")
    let dbres = await findtrack.get(req.params.id)
    if (dbres && dbres.title) {
        if (botRegex.test(req.get('User-Agent'))) {
            res.render('standard.spy', {title: dbres.title, description: dbres.description, image: dbres.image })
        }else {
            res.redirect(`https://tidal.com/browse/track/${req.params.id}`)
        }
    }else{
        console.log("SCRAPING TRACK")
        let sres = await Scrape(`https://tidal.com/browse/track/${req.params.id}`)
        if (sres && sres.title) {
            await inserttrack.run(req.params.id, sres.title, sres.description, sres.image)
            res.redirect(`/browse/track/${req.params.id}`)
        }else{
            switch (sres) {
                case 404:
                    await insertbadtrack.run(req.params.id)
                    res.status(404).send("NOT FOUND")
                    break;
                case 403:
                    res.status(500).send("REQUEST BLOCKED BY TIDAL<br>PLEASE TRY AGAIN LATER")
                    break;
                default:
                    res.status(500).send(`unknown ${sres}`)
                    break;
            }
        }
    }
})

app.get('(/browse)?/artist/:id', async (req, res) => {
    console.log("ARTIST REQUESTED")
    let dbres = await getartist.get(req.params.id)
    
    if (dbres && dbres.name) {
        if (botRegex.test(req.get("User-Agent"))) {
            res.render('standard.spy', {title: dbres.name, description: dbres.description, image: dbres.image })

        } else {
            res.redirect(`https://tidal.com/browse/artist/${req.params.id}`)
        }
    }else{
        console.log("SCRAPING ARTIST")
        let sres = await Scrape(`https://tidal.com/browse/artist/${req.params.id}`)
        if (sres && sres.title) {
            await insertartist.run(req.params.id, sres.title, sres.description, sres.image)
            res.redirect(`/browse/artist/${req.params.id}`)
        }else{
            switch (sres) {
                case 404:
                    await insertbadart.run(req.params.id)
                    res.status(404).send("NOT FOUND")
                    break;
                case 403:
                    res.status(500).send("REQUEST BLOCKED BY TIDAL<br>PLEASE TRY AGAIN LATER")
                    break;
                default:
                    res.status(500).send(`unknown ${sres}`)
                    break;
            }
        }
    }
})

// TODO: use middleware for both


app.get('(/browse)?/album/:id', async (req, res) => {
    console.log("ALBUM REQUESTED")
    let dbres = await getid.get(req.params.id)
    if (dbres && dbres.title && dbres.description && dbres.image) {
        console.log("SERVING FROM CACHE")
        if (botRegex.test(req.get("User-Agent"))) {
            res.render('standard.spy', {title: dbres.title, description: dbres.description, image: dbres.image })

        } else {
            res.redirect(`https://tidal.com/browse/album/${dbres.id}`)
        }
    } else {
        console.log("SCRAPING ALBUM/SINGLE")
        let sres = await Scrape(`https://tidal.com/browse/album/${req.params.id}`)
        if (sres && sres.title) {
            insertfound.run(req.params.id, sres.title, sres.description, sres.image)
            res.redirect(`/browse/album/${req.params.id}`)
        }else{
            switch (sres) {
                case 404:
                    await insertbad.run(req.params.id)
                    res.status(404).send("NOT FOUND")
                    break;
                case 403:
                    res.status(500).send("REQUEST BLOCKED BY TIDAL<br>PLEASE TRY AGAIN LATER")
                    break;
            }
        }
    }




    /*res.send(`<head>
        <meta property="og:title" content="TEST" />
        <meta property="og:author" content="Elperson" />
        <meta property="og:description" content="embed test" />
        <meta property="og:image" content="https://resources.tidal.com/images/5b22b4ad/2358/4418/acae/2a2c226e5945/1280x1280.jpg" />
    
    </head>`)*/
})

app.listen(port, '0.0.0.0', () => {
    console.log("Starting server...")
})