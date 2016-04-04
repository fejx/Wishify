var port = 80;
var webFilesDir = __dirname + "/htdocs/";

var app = require("express")();
var http = require("http").Server(app);
var fs = require("fs");
var io = require("socket.io")(http);
var request = require("request");
var readline = require("readline");

var nodeSpotifyWebHelper = require("node-spotify-webhelper");
var spotify = new nodeSpotifyWebHelper.SpotifyWebHelper();

var tracks = [];
var users = [];
var current = null;

var playing = false;
var paused = false;
var trackSleeper;

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (cmd) => {
    if (cmd == "sepp")
        spotify.pause(function (err, res) {
            console.info("he des is komplett unintressant!!");
            if (err)
                console.error("failed pausing spotify: ", err);
            process.exit();
        });
    else if (cmd == "spa�t")
        playNextTrack();
});

function findTrackPos(trackId) {
    for (var i = 0; i < tracks.length; i++)
        if (tracks[i].data.id == trackId)
            return i;

    return -1;
}

function findTrack(trackId) {
    var p = findTrackPos(trackId);

    return (p == -1 ? undefined : tracks[p]);
}

function arrayFind(array, element) {
    for (var i = 0; i < array.length; i++)
        if (array[i] === element)
            return i;
    return -1;
}

function getSendableTrack(track) {
    if (!track) return null;
    var newTrack = JSON.parse(JSON.stringify(track.data));
    newTrack.score = track.upvotes.length - track.downvotes.length;
    newTrack.owner = track.owner;
    return newTrack;
}

function getBestRatedTrackIndex() {
    if (tracks.length == 0)
        return undefined;

    var getScore = function (track) {
        return track.upvotes.length - track.downvotes.length;
    }

    var maxScore = getScore(tracks[0]);
    var highestTrackPos = 0;

    for (var i = 1; i < tracks.length; i++) {
        var s = getScore(tracks[i]);
        if (s > maxScore) {
            maxScore = s;
            highestTrackPos = i;
        }
    }

    return highestTrackPos;
}

function playNextTrack() {
    if (paused) {
        spotify.getStatus(function (err, res) {
            if (err)
                console.error("Error getting Spotify status: " + err);
            else {
                // calculate time left
                var pos_ms = parseFloat(res.playing_position) * 1000;
                var left = current.data.duration_ms - pos_ms;
                spotify.unpause(function (err, res) {
                    if (err)
                        console.error("Error unpausing spotify: " + err);
                    else {
                        clearTimeout(trackSleeper);
                        trackSleeper = setTimeout(function () {
                            playNextTrack();
                        }, left);
                        paused = false;
                        io.emit("unpaused");
                    }
                });
            }
        });
    } else if (tracks.length != 0) {
        var idx = getBestRatedTrackIndex();
        var track = tracks[idx];

        spotify.play(tracks[idx].data.uri, function (err, res) {
            if (err)
                console.error("Spotify play error: " + err);
            else {
                clearTimeout(trackSleeper);
                trackSleeper = setTimeout(function () {
                    playNextTrack();
                }, track.data.duration_ms);
                io.emit("now playing", getSendableTrack(track));
                current = track;
                tracks.splice(idx, 1);
                playing = true;
                
            }
        });
    } else {
        playing = false;
        current = null;
        io.emit("now playing", null);
    }
}

function htmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
    next();
});

io.on("connection", function (socket) {
    console.info(socket.id + " joined");

    users.push(socket.id);

    // send own id
    socket.emit("id", socket.id);

    // send current tracks
    var tracklist = [];
    tracks.forEach(function (t) {
        tracklist.push(getSendableTrack(t));
    });
    socket.emit("tracks", tracklist);
    io.emit("now playing", getSendableTrack(current));

    socket.on("disconnect", function () {
        console.info(socket.id + " left");

        // remove all votes from this client
        tracks.forEach(function (track) {
            var up = arrayFind(track.upvotes, socket.id);
            var down = arrayFind(track.downvotes, socket.id);
            if (up != -1) track.upvotes.splice(up, 1);
            if (down != -1) track.downvotes.splice(down, 1);
            if (up != -1 || down != -1)
                io.emit("track change", getSendableTrack(track));
        });

        // remove user from list
        users.splice(arrayFind(users, socket.id), 1);
    });

    socket.on("add track", function (msg) {
        if (typeof (msg) != "string")
            socket.emit("failed", "invalid add track message");
        else if (!msg.match("[0-9A-z]{22}"))
            socket.emit("failed", "invalid spotify id");
        else {
            // check if track already exists
            if (findTrack(msg))
                socket.emit("failed", "track already exists");
            else {
                // get meta info for track
                request(
                    "https://api.spotify.com/v1/tracks/" + msg,
                    function (error, response, body) {
                        if (error) {
                            socket.emit("failed", "track not found");
                        } else {
                            if (!findTrack(msg)) { // check if track was added in the meantime
                                var track = { data: JSON.parse(body), upvotes: [], downvotes: [], owner: socket.id };
                                tracks.push(track);
                                io.emit("track added", getSendableTrack(track));
                            }
                        }
                    }.bind(this)
                );
            }
        }
    });

    socket.on("remove track", function (msg) {
        if (typeof (msg) != "string")
            socket.emit("failed", "invalid add track message");
        else {
            var idx = findTrackPos(msg);
            if (idx == -1)
                socket.emit("failed", "track does not exist");
            else {
                var track = tracks[idx];
                if (track.owner != socket.id)
                    socket.emit("failed", "no permission to remove this track");
                else {
                    tracks.splice(idx, 1);
                    io.emit("track removed", getSendableTrack(track));
                }
            }
        }
    });

    socket.on("vote up", function (msg) {
        if (typeof (msg) != "string")
            socket.emit("failed", "invalid vote up message");
        else {
            msg = htmlEscape(msg);
            var track = findTrack(msg);
            
            if (!track)
                socket.emit("failed", "track not found");
            else {
                // check if client already upvoted
                if (arrayFind(track.upvotes, socket.id) != -1)
                    socket.emit("failed", "you already upvoted this track");
                else {
                    // remove downvote if user has downvoted
                    var pos = arrayFind(track.downvotes, socket.id)
                    if (pos != -1)
                        track.downvotes.splice(pos, 1);

                    // add upvote
                    track.upvotes.push(socket.id);

                    // broadcast change
                    io.emit("track change", getSendableTrack(track));
                }
            }
        }
    });

    socket.on("vote down", function (msg) {
        if (typeof (msg) != "string")
            socket.emit("failed", "invalid vote down message");
        else {
            msg = htmlEscape(msg);
            var track = findTrack(msg);

            if (!track)
                socket.emit("failed", "track not found");
            else {
                // check if client already downvoted
                if (arrayFind(track.downvotes, socket.id) != -1)
                    socket.emit("failed", "you already downvoted this track");
                else {
                    // remove upvote if user has upvoted
                    var pos = arrayFind(track.upvotes, socket.id)
                    if (pos != -1)
                        track.upvotes.splice(pos, 1);

                    // add downvote
                    track.downvotes.push(socket.id);

                    // broadcast change
                    io.emit("track change", getSendableTrack(track));
                }
            }
        }
    });

    socket.on("play", function () {
        if (paused || !playing) {
            if (tracks.length == 0)
                socket.emit("error", "playlist is empty")
            else
                playNextTrack();
        }
    });

    socket.on("pause", function () {
        if (playing) {
            clearTimeout(trackSleeper);
            spotify.pause();
            io.emit("paused");
            paused = true;
        }
    });
});

app.get("/*", function (req, res) {
    if (req.params.length == 0)
        res.params.push("index.html");

    var file = webFilesDir + req.params[0];
    fs.access(file, fs.F_OK, function (err) {
        if (err)
            res.sendStatus(404);
        else
            res.sendFile(file);
    });
});

http.listen(port, function () {
    console.info("listening on *:" + port);
});