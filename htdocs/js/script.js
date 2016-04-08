$('html').removeClass('no-js');
$('html').addClass('js');

var socket = io();

// contains score values of all tracks in the order they appear in #tracklist
var scores = [];

var tNowPl;
var tTrackL;

// adds track (object) to the tracklist at the correct position
function addTrack (track) {
	// find position to insert
	var i = 0;
	while (scores[i] != undefined && // stop at end of list
		track.score > scores[i]) // stop when track score is better than current score
		i++;
	
	insertTrackAt(createTrackHtml(track), track.score, i);
}

// returns jQuery element containing li element to insert into tracklist
function createTrackHtml (track) {
	// create html element
	var artistString = '';
	track.artists.forEach(function (artist) {
		if (artistString)
			artistString += ', ' + artist.name;
		else
			artistString = artist.name;
	});
	
	var element = $(tTrackL({
			title: track.name,
			album: track.album.name,
			artists: artistString,
			albumArtUrl: track.album.images[1].url,
			score: track.score,
			id: track.id
	}));
	
	// add click events for voting buttons
	element.find('.upvote').click(function () {
		socket.emit("vote up", track.id);
	});
	element.find('.downvote').click(function () {
		socket.emit("vote down", track.id);
	});
	
	return element;
}

// inserts jQuery element at index and sets score array accordingly
function insertTrackAt (trackElement, score, index)  {
	if  (index === 0) { // if first position
		if (scores.length == 0) { // if list is empty
			$('#tracklist').append(trackElement);
			scores[0] = score;
		} else { // list is not empty
			$('#tracklist li:eq(0)').before(trackElement);
			scores.splice(0, 0, score);			
		}
	} else { // not first position
		// insert into tracklist after the element above it
		$('#tracklist li:eq(' + (index - 1).toString() + ')').after(trackElement);
		// insert into score list
		// TODO: Test if this actually works
		scores.splice(index, 0, score);
	}
}

// Moves track from one position to another (from and to are indexes)
function moveTrackTo (from, to) {
	var source = $('#tracklist li:eq(' + from.toString() + ')');
	if (from < to)
		to++; // removing element from DOM will cause the rest of the list to get up one index
	insertTrackAt(source, scores[from], to);
}

// Updates the score of the track (object)
function updateTrackScore (track) {
	// update score value
	var element = $('#tracklist li#' + track.id);
	element.find('.score').html(track.score);
	
	// TODO: move track if needed
	
	// check if track needs to be moved
	
}

function setCurrentPlaying (track) {
	if (track) {
		// remove track from tracklist
		$('#tracklist li.' + track.id).remove();

		var artistString = '';
		track.artists.forEach(function (artist) {
			if (artistString)
				artistString += ', ' + artist.name;
			else
				artistString = artist.name;
		});

		$('#nowPlaying').html(tNowPl({
			title: track.title,
			album: track.album.name,
			artists: artistString,
			albumArtUrl: track.album.images[1].url,
			score: track.score
		}));
	} else { // input track is null or undefined
		$('#nowPlaying').html(''); // clear now playing info
	}
}

$(document).on('ready', function () {
	tNowPl = Handlebars.compile($('#nowPlaying-template').html());
	tTrackL = Handlebars.compile($('#track-template').html());
	
	$('#newTrackButton').click(function () {
		$('#newTrackPane').transition({y:'0'}, 500, 'snap');
		$('#newTrackPane input').focus();
	});
	
	$('#newTrackPane').click(function (e) {
		if (e.target.id == 'newTrackPane') {
			$('#newTrackPane').transition({y:'100%'});
			$("#newTrackPane input").val("");
			$("#newTrackPane ul").empty();
			$('#newTrackPane svg').hide();
		}
	});
	
	$("#newTrackPane input").keypress(function (e) {
        if (e.which == 13 && $("#newTrackPane input").val() != "") {
			$('#newTrackPane svg').show();
            $.get("https://api.spotify.com/v1/search?q=" + $("#newTrackPane input").val() + "&type=track", function (results) {
                $('#newTrackPane svg').hide();
				$("#newTrackPane ul").empty();
                $("#newTrackPane ul").show();
                results.tracks.items.forEach(function (t) {
                    var entry = $("<li />");
                    entry.html(t.artists[0].name + " - " + t.name);
                    entry.click(function () {
                        socket.emit("add track", t.id);
                        $('#newTrackPane').transition({y:'100%'});
                        $("#newTrackPane input").val("");
						$("#newTrackPane ul").empty();
                    });
                    $("#newTrackPane ul").append(entry);
                });

            });
        }
    });
	
	socket = io();
	
	socket.on('connect', function () {
		$('html').addClass('connected');
		
		// event triggered when a track gets added by a user
		socket.on('track added', function (t) {
        	addTrack(t);
		});
		
		// event triggered on connecting containing all current tracks on the server
		socket.on('tracks', function (tracklist) {
			tracklist.forEach(function (track) {
				addTrack(track);
			});
			$(tracklist[0]).hide();
		});
		
		// TODO: get upvote/downvote and update events
		socket.on('track change', function (track) {
			updateTrackScore(track)
		});

		socket.on('now playing'), function (track) {
			setCurrentPlaying(track);
		};
		
		$('.voting > button > svg').click(function (e) {
			$(e.target).addClass('clicked');
			
		});
		
		setTimeout(function () {
			$('html').addClass('loaded');
		}, 1000);
	});
	
});