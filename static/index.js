marked.setOptions({
    breaks: true,
    baseUrl: "elperson.pro"
})
document.getElementById("guide").innerHTML = marked.parse(`# **TIDALFIX USAGE GUIDE**

## Albums / Singles
<ol>
    <li>Get any TIDAL link e.g.:https://tidal.com/browse/album/148995697</li>
    <li>Replace tidal.com with elperson.pro</li>
    <li>Post it on discord and watch the embed show up!</li>
</ol>

## Artists
Basically the same process

## Tracks
Basically the same process`)