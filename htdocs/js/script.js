'use strict';

var html = $('html');
html.removeClass('no-js');
html.addClass('js');

const SEARCH_URL =
	'https://api.spotify.com/v1/search?q=[QUERY]&type=track';
const LOG_ENABLED = true;

var socket = io();
var tracklist;
var newTrackButton;
var newTrackPane;
var newTrackInput;
var nowPlaying;

Vue.transition('slideV', {
	enterClass: 'bounceInUp',
	leaveClass: 'bounceOutDown'
});

Vue.transition('zoomV', {
	enterClass: 'zoomInUp',
	leaveClass: 'zoomOutDown'
});

Vue.transition('fadeV', {
	enterClass: 'fadeInUp',
	leaveClass: 'fadeOutDown'
});

Vue.transition('slideH', {
	enterClass: 'slideInLeft',
	leaveClass: 'slideOutRight'
});

Vue.transition('zoom', {
	enterClass: 'zoomIn',
	leaveClass: 'zoomOut'
});

//noinspection JSUnusedAssignment,JSUnusedGlobalSymbols
var Vue = new Vue({
	el: 'body',
	data: {
		tracks: [],
		currentTrack: {},
		showSearchDialog: false,
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
			// clear previous entries
			newTrackInput.val('');
			Vue.searchResults = null;

			// show dialog
			this.showSearchDialog = true;

			// focus on input (timeout because of weird bug)
			setTimeout(function() {
				newTrackInput.focus()
			});
		},
		searchTrack: function () {
			if (newTrackInput.val() == '')
				return;
			this.searching = true;
			$.get(SEARCH_URL.replace('[QUERY]', newTrackInput.val()),
				function (results) {
				Vue.searching = false;
				Vue.searchResults = results.tracks.items
			});
		},
		addTrack: function (id) {
			sEmit('add track', id);
			this.showSearchDialog = false;
		},
		attractNewTrackButton: function () {
			newTrackButton.addClass('bounce');
			setTimeout (function () {
				newTrackButton.removeClass('bounce');
			}, 1000);
		}
	}
});

// returns position of track in the list
function findTrackId (track) {
	var i = 0;
	for (; i < Vue.tracks.length; i++)
		if (Vue.tracks[i].id == track.id)
			break;
	if (i < Vue.tracks.length)
		return i;
	else
		return undefined;
}

// adds track (object) to the tracklist
function addTrack (track) {
	if (findTrackId(track))
		console.warn('Tried to add track ', track, ' multiple times');
	else
		Vue.tracks.push(track)
}

// Updates the score of the track (object)
function updateTrackScore (track) {
	Vue.tracks[findTrackId(track)].score = track.score
}

function setCurrentPlaying (track) {
	Vue.currentTrack = null;
	// wait half a second for transition to show
	setTimeout(function () {
		Vue.currentTrack = track
	}, 500);


	// track might be null if no song is playing
	if (track) {
		var ind = findTrackId(track);
		if (ind != undefined)
			Vue.tracks.splice(findTrackId(track), 1)
	}
}

function sEmit (event, message) {
	socket.emit(event, message);
	if (LOG_ENABLED)
		console.log('--> ', event, ':', message)
}

function sOn (event, callback) {
	if (LOG_ENABLED)
		socket.on(event, function (message) {
			if (typeof(callback) == 'function')
				callback(message);
			console.log('<-- ', event, ':', message)
		});
	else
		socket.on(event, callback)
}

$(document).on('ready', function () {
	tracklist = $('#tracklist');
	newTrackButton = $('#newTrackButton');
	newTrackPane = $('#newTrackPane');
	newTrackInput = newTrackPane.find('input');
	nowPlaying = $('#nowPlaying');

	newTrackPane.click(function (e) {
		// hide pane when clicking outside
		if (e.target.id == 'newTrackPane')
			Vue.showSearchDialog = false;
	});

	sOn('connect', function () {
		html.addClass('connected');

		// event triggered when a track gets added by a user
		sOn('track added', function (t) {
        	addTrack(t)
		});

		// event triggered on connecting containing all current tracks on the server
		sOn('tracks', function (tracks) {
			Vue.tracks = [];
			tracks.forEach(function (track) {
				addTrack(track)
			});
		});

		sOn('score change', function (track) {
			updateTrackScore(track)
		});

		sOn('now playing', function (track) {
			setCurrentPlaying(track)
		});

		sOn('failed');

		$('.voting > button > svg').click(function (e) {
			$(e.target).addClass('clicked')
		});

		html.addClass('loaded');
	});

});
