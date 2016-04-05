$('html').removeClass('no-js');
$('html').addClass('js');

var tNowPl;
var tTrackL;

function addTrack (track) {
	// create html
	var artistString = '';
	track.artists.forEach(function (artist) {
		if (artistString)
			artistString += ', ' + artist.name;
		else
			artistString = artist.name;
	});
	
	var code = tTrackL({
			title: track.name,
			album: track.album.name,
			artists: artistString,
			albumArtUrl: track.album.images[1].url,
			score: track.score,
			id: track.id
		});
	
	// append to list
	$('#tracklist').append(code);
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
		
		$('#nowPlaying').html(tNowPl({
			title: '7 Yearskkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
			album: 'Lukas Graham (Blue Album)',
			artists: 'Lukas Graham',
			albumArtUrl: 'https://i.scdn.co/image/acc5f51a18dd57a43a44ecb94144fa65aca0b8a7',
			score: 5
		}));
		
		socket.on("track added", function (t) {
        	addTrack(t);
    	});
		
		socket.on("tracks", function (tracklist) {
			tracklist.forEach(function (track) {
				addTrack(track);
			});
		})
		
		$('.voting > button > svg').click(function (e) {
			$(e.target).addClass('clicked');
			
		})
		
		setTimeout(function () {
			$('html').addClass('loaded');
		}, 1000);
	});
	
});