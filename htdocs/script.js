$("html").removeClass("no-js").addClass("js");

var socket;
var trackList;
var playing;
var ownId;

function showMessage(type, msg) {
    var color

    switch(type) {
        case "error":
            color = "DarkRed";
            break;
        case "success":
            color = "darkgreen";
            break;
        case "info":
            color = "black";
            break;
    }

    $("#messageDisplay").css("background-color", color);
    $("#messageDisplay").text(msg);
    $("#messageDisplay").fadeIn("slow");
    setTimeout(function () {
        $("#messageDisplay").fadeOut("slow");
    }, 2000);
}

function createTrackListEntry(track) {
    return "<li>" + createTrackListEntryInner(track) + "</li>";
}

function createTrackListEntryInner(track) {
    // get artist list
    var artists = "";
    track.artists.forEach(function (a) {
        artists += "<span>" + a.name + "</span>";
    });

    var id = '<span class="hidden">' + track.id + "</span>";
    var votes = '<div class="votes"><img src="img/upvote.svg" onclick="voteUp(\'' + track.id + '\')" /><span>' + track.score + '</span><img src="img/downvote.svg" onclick="voteDown(\'' + track.id + '\')" /></div>';
    var albumArt = '<img src="' + track.album.images[0].url + '"/>';
    var trackInfo = '<div><span class="title">' + track.name + '</span><span class="artists">' + artists + '</span><span class="album">' + track.album.name + "</span></div>";
    var deleteButton = track.owner == ownId ? '<span class="deleteButton" onclick="removeTrack(\'' + track.id + '\')" />' : "";

    return id + votes + albumArt + trackInfo + deleteButton;
}

function voteUp(track) {
    socket.emit("vote up", track);
}
function voteDown(track) {
    socket.emit("vote down", track);
}

function removeTrack(track) {
    socket.emit("remove track", track);
}

$(document).ready(function () {
    socket = io();
    trackList = $("#trackList");

    socket.on("connect", function () {
        $("main").fadeIn(1000);
        $("footer").animate({ 'bottom': '0%' }, 1000);
    });

    socket.on("reconnecting", function (number) {
        showMessage("info", "reconnecting...");
    });

    socket.on("reconnect", function () {
        showMessage("success", "reconnected");
    });

    socket.on("reconnect_failed", function () {
        showMessage("error", "connection lost");
    });

    socket.on("failed", function (msg) {
        showMessage("error", msg);
        console.log("Socket error: " + msg);
    });

    socket.on("success", function (s) {
        showMessage("success", s);
    });

    socket.on("id", function (id) {
        ownId = id;
    });

    // tracks
    //
    socket.on("tracks", function (tracks) {
        trackList.empty();
        tracks.forEach(function (t) {
            trackList.append(createTrackListEntry(t));
        });
    });

    socket.on("track added", function (t) {
        trackList.append(createTrackListEntry(t));
    });

    socket.on("track removed", function (t) {
        var entry = $("#trackList li").filter(function (idx) {
            return this.innerHTML.startsWith('<span class="hidden">' + t.id + "</span>");
        })[0];

        entry.remove();
    });

    socket.on("track change", function (t) {
        var entry = $("#trackList li").filter(function (idx) {
            return this.innerHTML.startsWith('<span class="hidden">' + t.id + "</span>");
        })[0];

        entry.innerHTML = createTrackListEntryInner(t);
    });

    socket.on("now playing", function (t) {
        if (t) {
            var entry = $("#trackList li").filter(function (idx) {
                return this.innerHTML.startsWith('<span class="hidden">' + t.id + "</span>");
            });

            if (entry.length != 0)
                entry[0].remove();

            $("#nowPlaying").html(createTrackListEntryInner(t));
            $("#playPause").attr("src", "img/pause.svg");
            playing = true;
        } else {
            $("#nowPlaying").empty();
            $("#playPause").attr("src", "img/play.svg");
            playing = false;
        }
    });

    socket.on("paused", function () {
        $("#playPause").attr("src", "img/play.svg");
        playing = false;
    });

    socket.on("unpaused", function () {
        $("#playPause").attr("src", "img/pause.svg");
        playing = true;
    });


    /*$("#spotifyUrl").on("input", function () {
        var regex = /(http(s)?:\/\/)?open.spotify.com\/track\/([0-9A-z]{22})/g;
        var match = regex.exec($("#spotifyUrl").val());
        if (match)
            $("#spotifyUrl").val(match[3]);
    });*/

    $("#playPause").click(function () {
        if (playing)
            socket.emit("pause");
        else
            socket.emit("play");
    });

    $("#searchField").click(function (e) {
        $("#searchResults").toggle();
    });

    $("#searchField").keypress(function (e) {
        if (e.which == 13 && $("#searchField").val() != "") {
            $.get("https://api.spotify.com/v1/search?q=" + $("#searchField").val() + "&type=track", function (results) {
                $("#searchResults").empty();
                $("#searchResults").show();
                results.tracks.items.forEach(function (t) {
                    var entry = $("<li />");
                    entry.html(t.artists[0].name + " - " + t.name);
                    entry.click(function () {
                        socket.emit("add track", t.id);
                        $("#searchResults").hide();
                        $("#searchField").val("");
                    });
                    $("#searchResults").append(entry);
                });

            });
        }
    });
});