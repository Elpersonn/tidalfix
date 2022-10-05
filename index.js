/*
    Tidalfix - Tidal link embedder
    Copyright (C) 2022 Elperson

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

*/
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const express = require('express')
const crypt = require("node:crypto")
const http = require('http')
const puppeteer = require('puppeteer')
const teplates = require('sprightly')
import {secret, port} from './config.mjs'
import { exec } from 'node:child_process'
import { pid } from 'node:process'

//const Tidal = require('tidalapi')
const db = require('better-sqlite3')('tidalfix.db')
const getid = db.prepare("SELECT * FROM ALBUMS WHERE ID = ?")
const insertbad = db.prepare("INSERT INTO blacklisted (ID) VALUES (?)")
const findbad = db.prepare("SELECT * FROM blacklisted WHERE ID = ?")
const insertfound = db.prepare("INSERT INTO ALBUMS (id, created, title, description, image) VALUES (?, strftime('%s', 'now'), ?, ?, ?)")
const getartist = db.prepare("SELECT * FROM artists WHERE id = ?")
const insertartist = db.prepare("INSERT OR IGNORE INTO ARTISTS (id, created, name, description, image) VALUES (?, strftime('%s', 'now'), ?, ?, ?)")
const findbadartist = db.prepare("SELECT * FROM artist_blacklist WHERE ID = ?")
const insertbadart = db.prepare("INSERT OR IGNORE INTO artist_blacklist (ID) VALUES (?);")
const findbadtrack = db.prepare("SELECT * FROM track_blacklist WHERE ID = ?")
const insertbadtrack = db.prepare("INSERT OR IGNORE INTO track_blacklist (ID) VALUES (?)")
const findtrack = db.prepare("SELECT * FROM tracks WHERE id = ?")
const inserttrack = db.prepare("INSERT OR IGNORE INTO tracks (id, created, title, description, image) VALUES (?, strftime('%s', 'now'), ?, ?, ?)")

// woohoo i just love writing 500 sql prepared statements...
console.log("STARTING TIDALFIX V0.4\nMADE BY ELPERSON 2022")
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
app.use("(/browse)?/:any/:id", ValidateId)
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
app.get('(/browse)?/:empath/:id/json', async (req, res) => {
    res.json({
        "provider_name": "Listen on TIDAL",
        "provider_url": `https://tidal.com/browse/${req.params.empath}/${req.params.id}`,
    })
    
})

app.post('/gitPush', async (req, res) => {
    let secure = req.get('x-hub-signature-256')

    if (secure != undefined) {
        let verif = crypt.createHmac('SHA256', secret).update(req.body).digest('hex')
        if (verif == secure) {
            console.log('good')
            exec(`./update.sh ${pid}`)
            res.status(200).send('UPDATING\nPLEASE HOLD...')
        }else {
            res.status(401).send('nice try')
        }
    }else {
        res.status(400).send('missing')
    }
})
// TODO: DO THE UNDERMENTIONED
// all the browse code could be boiled down to a single thing tbf
app.get('(/browse)?/:type/:id', async (req, res) => {
    if (req.params.type.toLowerCase() != "album" && req.params.type.toLowerCase() != "track" && req.params.type.toLowerCase() != "artist" ){
        res.status(400).send("Wrong type")
    }//                                               vvvvvvvvvvvvvvvvvvvvvvvvvvvvv - Yes, this DOES have the possibility of an SQL injection but not when I literally sanitized it and checked it
    let dbres = await db.prepare(`SELECT * FROM ${req.params.type.toLowerCase() + "s"} WHERE id = ?`).get(req.params.id)
    if (dbres && dbres.title) {
        if (botRegex.test(req.get('User-Agent'))) {
            res.render('standard.spy', {title: dbres.title, description: dbres.description, image: dbres.image, request: req.params.id  })
        }else {
            res.redirect(`https://tidal.com/browse/${req.params.type}/${req.params.id}`)
        }
    }else{
        console.log("SCRAPING")
        let sres = await Scrape(`https://tidal.com/browse/${req.params.type}/${req.params.id}`)
        if (sres && sres.title) {//             vvvvvvvvvvvvvvvvvvvvvvvvvvvvv - line 154
            await db.prepare(`INSERT INTO ${req.params.type.toLowerCase() + "s"} (id, created, ${(req.params.type == 'artist') ? "name" : "title"}, description, image) VALUES (?, strftime('%s', 'now'), ?, ?, ?)`).run(req.params.id, sres.title, sres.description, sres.image)
            res.redirect(`/browse/${req.params.type}/${req.params.id}`)  //                                              ^ plural :)
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
app.listen(port, '0.0.0.0', () => {
    console.log("Starting server...")
    console.warn(`Running on port ${port}`)
})