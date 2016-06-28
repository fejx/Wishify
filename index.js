const PORT = 80;
const WEB_FILES_DIR = __dirname + '/htdocs/';

var app = require('express')();
var http = require('http').Server(app);
var fs = require('fs');
var io = require('socket.io')(http);
var request = require('request');
var readline = require('readline');

var SpotifyWebHelper = require('@jonny/spotify-web-helper');
var helper = SpotifyWebHelper();

var tracks = [];
var users = {};
var current = null;

var playing = false;
var paused = false;
var waitingForTrack = true;

// returns new uuid, stolen from http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function newUuid() {
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
		s4() + '-' + s4() + s4() + s4();
}

function s4() {
	return Math.floor((1 + Math.random()) * 0x10000)
		.toString(16)
		.substring(1);
}

function checkUuid(uuid) {
	if (typeof(uuid) != 'string')
		return false;
	var res = uuid.match('([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})');
	if (res)
		return res[0];
	else return false;
}

// returns index of track with trackId
function findTrackPos (trackId) {
	for (var i = 0; i < tracks.length; i++)
		if (tracks[i].data.id == trackId)
			return i;

	return -1
}

// returns track with trackId
function findTrack (trackId) {
	var p = findTrackPos(trackId);

	return (p == -1 ? undefined : tracks[p])
}

// returns index of element in array
function arrayFind (array, element) {
	for (var i = 0; i < array.length; i++)
		if (array[i] === element)
			return i;
	return -1
}

// returns track that is suitable for sending (internal representation of tracks contain more information that needed)
function getSendableTrack (track, socket) {
	if (!track)
		return null;
	var newTrack = JSON.parse(JSON.stringify(track.data));
	newTrack.score = track.upvotes.length - track.downvotes.length;
	if (socket == null)
		newTrack.owning = false;
	else
		newTrack.owning = track.owner == socket.uuid;
	return newTrack
}

// returns index of track with highest score
function getBestRatedTrackIndex () {
	if (tracks.length == 0)
		return undefined;

	var getScore = function (track) {
		return track.upvotes.length - track.downvotes.length
	};

	var maxScore = getScore(tracks[0]);
	var highestTrackPos = 0;

	for (var i = 1; i < tracks.length; i++) {
		var s = getScore(tracks[i]);
		if (s > maxScore) {
			maxScore = s;
			highestTrackPos = i
		}
	}

	return highestTrackPos
}

// plays next track from queue
function playNextTrack () {
	if (tracks.length != 0) {
		var idx = getBestRatedTrackIndex();
		current = tracks[idx];
		tracks.splice(idx, 1);
		helper.player.play(current.data.uri);
		io.emit('now playing', getSendableTrack(current));
		playing = true;
		paused = false
	}
	else if (current != null) {
		// no tracks left
		playing = false;
		current = null;
		io.emit('now playing', null);
	}
}

function htmlEscape (str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
}

app.use(function (req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
	next()
});

// handle socket clients
io.on('connection', function (socket) {
	console.info(socket.id + ' joined');

	socket.on('login', function (uuid) {
		if (uuid) {
			uuid = checkUuid(uuid);
			if (uuid == false) {
				socket.disconnect();
				return
			}
		} else
			uuid = newUuid();

		users[uuid] = socket.id;
		socket.uuid = uuid;

		// send own id
		socket.emit('id', uuid);

		// send current tracks
		var tracklist = [];
		tracks.forEach(function (t) {
			tracklist.push(getSendableTrack(t, socket))
		});
		socket.emit('tracks', tracklist);
		socket.emit('now playing', getSendableTrack(current));
	});

	socket.on('disconnect', function () {
		console.info(socket.id + ' left');

		// remove user from user store
		users[socket.uuid] = undefined
	});

	socket.on('add track', function (msg) {
		if (typeof (msg) != 'string')
			socket.emit('failed', 'invalid add track message');
		else if (!msg.match('[0-9A-z]{22}'))
			socket.emit('failed', 'invalid spotify id');
		else {
			// check if track already exists
			if (findTrack(msg))
				socket.emit('failed', 'track already exists');
			else {
				// get meta info for track
				request(
					'https://api.spotify.com/v1/tracks/' + msg,
					function (error, response, body) {
						if (error) {
							socket.emit('failed', 'track not found');
						} else {
							if (!findTrack(msg)) { // check if track was added in the meantime
								var track = {
									data: JSON.parse(body),
									upvotes: [],
									downvotes: [],
									owner: socket.uuid
								};
								tracks.push(track);
								if (!playing && waitingForTrack) // player is waiting for tracks, immediately start playing
									playNextTrack();
								else {
									io.emit('track added', getSendableTrack(track));
									socket.emit('owning', track.data.id)
								}
							}
						}
					}.bind(this)
				)
			}
		}
	});

	socket.on('remove track', function (msg) {
		if (typeof (msg) != 'string')
			socket.emit('failed', 'invalid add track message');
		else {
			var idx = findTrackPos(msg);
			if (idx == -1)
				socket.emit('failed', 'track does not exist');
			else {
				var track = tracks[idx];
				if (track.owner != socket.uuid)
					socket.emit('failed', 'no permission to remove this track');
				else {
					tracks.splice(idx, 1);
					io.emit('track removed', getSendableTrack(track).id)
				}
			}
		}
	});

	socket.on('vote up', function (msg) {
		if (typeof (msg) != 'string')
			socket.emit('failed', 'invalid vote up message');
		else {
			msg = htmlEscape(msg);
			var track = findTrack(msg);

			if (!track)
				socket.emit('failed', 'track not found');
			else {
				// check if client already upvoted
				if (arrayFind(track.upvotes, socket.uuid) != -1)
					socket.emit('failed', 'you already upvoted this track');
				else {
					// remove downvote if user has downvoted
					var pos = arrayFind(track.downvotes, socket.uuid);
					if (pos != -1)
						track.downvotes.splice(pos, 1);

					// add upvote
					track.upvotes.push(socket.uuid);

					// broadcast change
					sTrack = getSendableTrack(track);
					io.emit('score change', {id: sTrack.id, score: sTrack.score})
				}
			}
		}
	});

	socket.on('vote down', function (msg) {
		if (typeof (msg) != 'string')
			socket.emit('failed', 'invalid vote down message');
		else {
			msg = htmlEscape(msg);
			var track = findTrack(msg);

			if (!track)
				socket.emit('failed', 'track not found');
			else {
				// check if client already downvoted
				if (arrayFind(track.downvotes, socket.uuid) != -1)
					socket.emit('failed', 'you already downvoted this track');
				else {
					// remove upvote if user has upvoted
					var pos = arrayFind(track.upvotes, socket.uuid);
					if (pos != -1)
						track.upvotes.splice(pos, 1);

					// add downvote
					track.downvotes.push(socket.uuid);

					// broadcast change
					sTrack = getSendableTrack(track);
					io.emit('score change', {id: sTrack.id, score: sTrack.score})
				}
			}
		}
	});

	// Admin commands

	function checkAdmin (id) {
		// for testing purposes, all clients are considered admins
		return true;
		//socket.emit('failed', 'no permission to execute this command');
	}

	socket.on('pause', function () {
		if (checkAdmin(socket.uuid) && playing && !paused) {
			helper.player.pause();
			io.emit('paused');
			paused = true
		}
	});

	socket.on('unpause', function () {
		if (checkAdmin(socket.uuid) && playing && paused) {
			helper.player.play();
			io.emit('unpaused');
			paused = false
		}
	});

	socket.on('next', function () {
		if (checkAdmin(socket.uuid))
			playNextTrack()
	})
});

// Little HTTP server to send client page (located in htdocs folder)
app.get('/*', function (req, res) {
	if (req.params.length == 0)
		res.params.push('index.html');

	var file = WEB_FILES_DIR + req.params[0];
	fs.access(file, fs.F_OK, function (err) {
		if (err)
			res.sendStatus(404);
		else
			res.sendFile(file)
	})
});

console.info('Connecting to Spotify...');

helper.player.on('ready', function() {
	helper.player.on('error', function(err) {
		console.error('Error with Spotify: ', JSON.stringify(err))
	});

	helper.player.on('pause', function() {
		if (!paused)
			playNextTrack();
	});

	http.listen(PORT, function () {
		console.info('listening on *:' + PORT)
	})
});
