var html = $('html');
html.removeClass('no-js');
html.addClass('js');

const SEARCH_URL =
	'https://api.spotify.com/v1/search?q=[QUERY]&type=track';

var socket = io();
var tracklist;
var newTrackPane;
var newTrackInput;
var nowPlaying;

//noinspection JSUnusedAssignment,JSUnusedGlobalSymbols
var Vue = new Vue({
	el: 'body',
	data: {
		tracks: [],
		currentTrack: {},
		searching: false,
		searchResults: []
	},
	methods: {
		voteUp: function (id) {
			sEmit('vote up', id)
		},
		voteDown: function (id) {
			sEmit('vote down', id)
		},
		openAddDialog: function () {
			newTrackPane.transition({y:'0'}, 500, 'snap');
			newTrackInput.focus()
		},
		searchTrack: function () {
			if (newTrackInput.val() == '')
				return;
			Vue.searching = true;
			$.get(SEARCH_URL.replace('[QUERY]', newTrackInput.val()),
				function (results) {
				Vue.searching = false;
				Vue.searchResults = results.tracks.items
			});
		},
		addTrack: function (id) {
			sEmit('add track', id);
			hideAddTrackPane()
		}
	}
});

function findTrackId (track) {
	for (var i = 0; i < Vue.tracks.length; i++)
		if (Vue.tracks[i].id == track.id)
			return i
}

function hideAddTrackPane () {
	newTrackPane.transition({y:'100%'}, 500);
	setTimeout(function () {
		newTrackInput.val('');
		Vue.searchResults = null;
	}, 500)
}

// adds track (object) to the tracklist
function addTrack (track) {
	Vue.tracks.push(track);
	sortTracks()
}

// Updates the score of the track (object)
function updateTrackScore (track) {
	Vue.tracks[findTrackId(track)].score = track.score;
	sortTracks()
}

function sortTracks () {
	Vue.tracks.sort(function (t1, t2) {
		return t2.score - t1.score
	});
}

function setCurrentPlaying (track) {
	Vue.currentTrack = track;

	// track might be null if no song is playing
	if (track) {
		Vue.tracks.splice(findTrackId(track), 1);
		nowPlaying.removeClass('hide').addClass('show')
	}
	else
		nowPlaying.removeClass('show').addClass('hide')
}

function sEmit (event, message) {
	socket.emit(event, message);
	console.log(event, message)
}

function sOn (event, callback) {
	socket.on(event, function (message) {
		callback(message);
		console.log(event, message)
	});
}

$(document).on('ready', function () {
	tracklist = $('#tracklist');
	newTrackPane = $('#newTrackPane');
	newTrackInput = newTrackPane.find('input');
	nowPlaying = $('#nowPlaying');

	newTrackPane.click(function (e) {
		// hide pane when clicking outside
		if (e.target.id == 'newTrackPane')
			hideAddTrackPane()
	});

	sOn('connect', function () {
		html.addClass('connected');

		// event triggered when a track gets added by a user
		sOn('track added', function (t) {
        	addTrack(t);
			console.log('add', t)
		});

		// event triggered on connecting containing all current tracks on the server
		sOn('tracks', function (tracklist) {
			tracklist.forEach(function (track) {
				addTrack(track)
			});
			console.log('tracks', tracklist)
		});

		sOn('track change', function (track) {
			updateTrackScore(track);
			console.log('update', track)
		});

		sOn('now playing', function (track) {
			setCurrentPlaying(track);
			console.log('now playing', track)
		});

		$('.voting > button > svg').click(function (e) {
			$(e.target).addClass('clicked');

		});

		html.addClass('loaded');
	});

});