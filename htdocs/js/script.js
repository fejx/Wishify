$('html').removeClass('no-js');
$('html').addClass('js');

var tNowPl;
var tTrackL;

$(document).on('ready', function () {
	tNowPl = Handlebars.compile($('#nowPlaying-template').html());
	tTrackL = Handlebars.compile($('#track-template').html());
	
	$('#newTrackButton').click(function () {
		$('#newTrackPane').transition({y:'0'}, 500, 'snap');
	});
	
	$('#newTrackPane').click(function () {
		$('#newTrackPane').transition({y:'100%'});
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
		
		$('#tracklist').append(tTrackL({
			title: '7 Yearkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkks',
			album: 'Lukas Graham (Blue Album)',
			artists: 'Lukas Grahakkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
			albumArtUrl: 'https://i.scdn.co/image/acc5f51a18dd57a43a44ecb94144fa65aca0b8a7',
			score: 5
		}));
		
		for (var i = 0; i < 10; ++i)
		$('#tracklist').append(tTrackL({
			title: '7 Years',
			album: 'Lukas Graham (Blue Album)',
			artists: 'Lukas Graham',
			albumArtUrl: 'https://i.scdn.co/image/acc5f51a18dd57a43a44ecb94144fa65aca0b8a7',
			score: 5
		}));
		
		$('.voting > button > svg').click(function (e) {
			$(e.target).addClass('clicked');
			
		})
		
		setTimeout(function () {
			$('html').addClass('loaded');
		}, 1000);
	});
	
});