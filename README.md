# TIDALFIX - Tidal link embed gemerator
TIDALFIX is a service which generates pretty embeds so that you can share them on discord
<br>
Preview:
![image info](https://cdn.discordapp.com/attachments/783744515973709875/950456394862174228/unknown.png)
<br>
The embedder currently supports:
- Albums / Singles / EPs
- Artist
- Songs / Tracks

# INSTALLATION
1. Clone the repo
2. Install the dependencies
3. Create a SQLite database (`sqlite3 tidalfix.db`)
4. Recreate the TIDALFIX database schema by running `sqlite3 dump.db`
5. Make sure the tables were created correctly using `.tables`
6. Start the server using `node index.js`
