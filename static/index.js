marked.setOptions({
    breaks: true,
    baseUrl: "tidalfix.com"
})
document.getElementById("guide").innerHTML = marked.parse(`# **TIDALFIX USAGE GUIDE**
<ol>
    <li>Get any TIDAL link e.g.:https://tidal.com/browse/album/148995697</li>
    <li>Replace tidal.com with tidalfix.com</li>
    <li>Post it on discord and watch the embed show up!</li>
</ol>`)