(function () {
	var initialCameraPosition = {
			x: 0,
			y: 1.82,
			z: -6
		},

		SIDES = 6,
		WALL_HEIGHT = 5,
		ROOM_RADIUS = 8,

		camera,
		head,
		scene,
		renderer,
		vrEffect,
		vrControls,

		keys = {
			forward: false,
			left: false,
			backward: false,
			right: false
		},

		playButton = document.getElementById('play'),
		vrButton = document.getElementById('vr'),
		//recordButton = document.getElementById('record'),
		timeline = document.getElementById('timeline'),
		progress = document.getElementById('progress'),
		infobutton = document.getElementById('infobutton'),
		info = document.getElementById('info'),

		posters = [
			video,
			'a-world-not-ours-poster.jpg',
			'cutie-and-the-boxer-poster.jpg',
			'fallen-city-poster.jpg',
			'a-world-not-ours-poster.jpg',
			'cutie-and-the-boxer-poster.jpg'
		],
		videos = [],

		recordedMotion = [],
		recordingDuration = 0;

	THREE.Clock.prototype.reset = function () {
		this.startTime = 0;
		this.oldTime = 0;
		this.elapsedTime = 0;
	};


	var clock = new THREE.Clock();

	var lastVideoTime = -1,
		playbackIndex = 0,
		playing = false,
		recording = false,
		playbackClock = new THREE.Clock();

	function startRecording() {
		if (vrEffect.isFullscreen() || vrEffect.vrPreview()) {
			recordedMotion.length = 0;
			recording = true;
			playbackClock.reset();
			playbackClock.start();
		}
	}

	function stopRecording() {
		var saved;
		if (recording) {
			recordingDuration = playbackClock.getElapsedTime();
			playbackClock.stop();
			recording = false;
			if (recordedMotion.length && recordingDuration) {
				playButton.disabled = false;
			} else {
				playButton.disabled = true;
			}
			saved = JSON.stringify(recordedMotion);
			console.log(saved);
			try {
				window.localStorage.setItem('hmdRecord', saved);
				window.localStorage.setItem('recordingDuration', recordingDuration);
			} catch (e) {
				console.log('Failed to save recorded HMD motion');
			}
		}
	}

	function animate() {
		var delta = clock.getDelta(),
			frame,
			currentTime,
			previous;

		videos.forEach(function (tex) {
			var video = tex.image;
			if ( video && video.readyState > 1 && !video.paused ) {
				tex.needsUpdate = true;
			}
		});

		if (recording) {
			recordedMotion.push({
				time: playbackClock.getElapsedTime(),
				position: {
					x: camera.position.x,
					y: camera.position.y,
					z: camera.position.z
				},
				quaternion: {
					x: camera.quaternion.x,
					y: camera.quaternion.y,
					z: camera.quaternion.z,
					w: camera.quaternion.w
				}
			});
		} else if (playing) {
			currentTime = playbackClock.getElapsedTime();
			progress.style.width = currentTime / recordingDuration * 100 + '%';

			if (currentTime >= lastVideoTime) {
				frame = recordedMotion[playbackIndex];
				previous = frame;
				while (playbackIndex < recordedMotion.length) {
					frame = recordedMotion[playbackIndex];
					previous = frame;
					if (frame.time > currentTime) {
						break;
					}
					playbackIndex++;
				}
			}

			//todo: interpolate
			if (previous) {
				camera.quaternion.set(
					previous.quaternion.x,
					previous.quaternion.y,
					previous.quaternion.z,
					previous.quaternion.w
				);
				camera.position.set(
					previous.position.x,
					previous.position.y,
					previous.position.z
				);
			} else {
				progress.style.width = 0;
				stop();
			}
		}

		vrControls.update();
		vrEffect.render( scene, camera );
		//spotLight.

		requestAnimationFrame( animate );
	}

	function play() {
		playing = true;
		playbackIndex = 0;
		playbackClock.reset();
		playbackClock.start();
		timeline.style.display = '';
		playButton.textContent = 'Stop';
	}

	function stop() {
		playing = false;
		playbackIndex = 0;
		playbackClock.stop();
		timeline.style.display = 'none';
		playButton.textContent = 'Play';
		vrControls.reset();
	}

	function initScene() {
		renderer = new THREE.WebGLRenderer();
		//renderer.shadowMapEnabled = true;
		renderer.shadowMapType = THREE.PCFSoftShadowMap;

		document.body.appendChild( renderer.domElement );

		vrEffect = new THREE.VRStereoEffect(renderer);
		vrEffect.addEventListener('fullscreenchange', function () {
			vrControls.freeze = !(vrEffect.isFullscreen() || vrEffect.vrPreview());
			if (vrControls.freeze) {
				vrControls.reset();
			}
			stopRecording();
		});

		scene = new THREE.Scene();

		head = new THREE.Object3D();
		head.rotateY(Math.PI);
		head.position.x = initialCameraPosition.x;
		head.position.y = initialCameraPosition.y;
		head.position.z = initialCameraPosition.z;
		scene.add(head);

		camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000);
		head.add(camera);

		var directionLight = new THREE.DirectionalLight(0xffffff, 1, 1000);
		directionLight.position.set(0.2, 1, 0).normalize();
		scene.add(directionLight);

		var ambientLight = new THREE.AmbientLight( 0x404040 ); // soft white light
		scene.add( ambientLight );

		var lightTarget = new THREE.Object3D();
		lightTarget.position.set(0, 0, -2);
		camera.add(lightTarget);

		var spotLight = new THREE.SpotLight(0xffffff, 1, 1000);
		spotLight.castShadow = true;
		spotLight.position.set(0, 0.1, 0);
		spotLight.target = lightTarget;
		spotLight.shadowMapWidth = 1024;
		spotLight.shadowMapHeight = 1024;
		spotLight.shadowCameraNear = 1;
		spotLight.shadowCameraFar = 200;
		spotLight.shadowCameraFov = 80;
		//spotLight.shadowBias = 0.2;
		//spotLight.shadowCameraVisible = true;
		camera.add(spotLight);

		vrControls = new THREE.VRControls( camera );
		vrControls.freeze = true;

		var floorTexture = THREE.ImageUtils.loadTexture( 'images/concrete.jpg' );
		floorTexture.anisotropy = renderer.getMaxAnisotropy();
		floorTexture.wrapS = THREE.RepeatWrapping;
		floorTexture.wrapT = THREE.RepeatWrapping;
		floorTexture.repeat.set(6, 6);

		var floorSize = 20;
		var floor = new THREE.Mesh(
			new THREE.PlaneGeometry(floorSize, floorSize),
			new THREE.MeshPhongMaterial({
				color: 0x554433,
				shininess: 10,
				//emissive: 0xffffff,
				//side: THREE.BackSide,
				map: floorTexture,
				shading: THREE.SmoothShading
			})
		);
		floor.receiveShadow = true;
		floor.rotateX(-Math.PI / 2);
		scene.add(floor);

		var walls = new THREE.Mesh(
			new THREE.CylinderGeometry( ROOM_RADIUS, ROOM_RADIUS, WALL_HEIGHT, SIDES, 1, true ),
			new THREE.MeshLambertMaterial({
				color: 0x999999,
				side: THREE.BackSide,
				shading: THREE.FlatShading
			})
		);
		walls.position.y = 2;
		walls.receiveShadow = true;
		scene.add(walls);

		//make posters
		var posterGeo = new THREE.PlaneGeometry(1, 1);
		var inradius = ROOM_RADIUS * Math.cos(Math.PI / SIDES) - 0.01;
		posters.forEach(function ( source, index ) {
			var posterTex,
				posterMat,
				poster,
				angle;

			function loaded() {
				poster.scale.x = poster.scale.y * posterTex.image.naturalWidth / posterTex.image.naturalHeight;
				console.log('aspect', posterTex.image.naturalWidth / posterTex.image.naturalHeight);
			}

			function loadedVideo() {
				console.log('loaded', source);
				poster.scale.x = poster.scale.y * video.videoWidth / video.videoHeight;
				source.play();
			}

			if (typeof source === 'string') {
				posterTex = THREE.ImageUtils.loadTexture( 'images/' + source, null, loaded );
				posterTex.anisotropy = renderer.getMaxAnisotropy();
			} else {
				posterTex = new THREE.Texture( source );
				posterTex.min_filter = THREE.LinearFilter;
				posterTex.mag_filter = THREE.LinearFilter;
				source.addEventListener('loadedmetadata', loadedVideo);
				source.addEventListener('seeked', function () {
					posterTex.needsUpdate = true;
				});
				videos.push(posterTex);
			}

			posterMat = new THREE.MeshPhongMaterial({
				color: 0xffffff,
				shininess: 20,
				map: posterTex,
				//side: THREE.DoubleSide,
				shading: THREE.FlatShading
			});

			angle = (index + 0.5) * 2 * Math.PI / SIDES;

			poster = new THREE.Mesh( posterGeo, posterMat );
			poster.rotateY(angle + Math.PI);
			poster.scale.y = 0.8 * WALL_HEIGHT;
			poster.position.y = (poster.scale.y) / 2;
			poster.position.x = Math.sin(angle) * inradius;
			poster.position.z = Math.cos(angle) * inradius;

			scene.add(poster);

			if (video.videoWidth && source === video) {
				loadedVideo();
			}
		});
	}

	function resize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		//todo: renderer.setSize(width, height);
	}

	function init() {
		var duration,
			rec,
			xhr;

		initScene();

		resize();
		window.addEventListener('resize', resize, false);

		vrButton.addEventListener('click', function () {
			vrEffect.requestFullScreen();
		}, false);

		//todo: set up button to trigger full screen
		window.addEventListener('keydown', function (evt) {
			console.log('keydown', evt.keyCode);
			if (evt.keyCode === 38) { //up
				keys.forward = true;
			} else if (evt.keyCode === 40) { //down
				keys.backward = true;
			} else if (evt.keyCode === 37) { //left
				keys.left = true;
			} else if (evt.keyCode === 39) { //right
				keys.right = true;
			} else if (evt.keyCode === 'R'.charCodeAt(0)) {
				if (recording) {
					stopRecording();
				} else {
					startRecording();
				}
			} else if (evt.keyCode === 'Z'.charCodeAt(0) && !recording) {
				vrControls.zeroSensor();
			} else if (evt.keyCode === 'P'.charCodeAt(0)) {
				if (!vrEffect.isFullscreen()) {
					vrEffect.vrPreview(!vrEffect.vrPreview());
					vrControls.freeze = !vrEffect.vrPreview();
					if (vrControls.freeze) {
						vrControls.reset();
					}
					stopRecording();
				}
			} else if (evt.keyCode === 187 || evt.keyCode === 61) { //+
				//resizeFOV(0.1);
			} else if (evt.keyCode === 189 || evt.keyCode === 173) { //-
				//resizeFOV(-0.1);
			} else if (evt.keyCode === 13) {
				vrEffect.requestFullScreen();
			}
		}, false);

		window.addEventListener('keyup', function (evt) {
			if (evt.keyCode === 38) { //up
				keys.forward = false;
			} else if (evt.keyCode === 40) { //down
				keys.backward = false;
			} else if (evt.keyCode === 37) { //left
				keys.left = false;
			} else if (evt.keyCode === 39) { //right
				keys.right = false;
			}
		}, false);

		window.addEventListener('touchend', function () {
			vrEffect.requestFullScreen();
		});

		playButton.addEventListener('click', function () {
			if (playing) {
				stop();
			} else {
				play();
			}
		}, false);

		infobutton.addEventListener('click', function () {
			if (info.className) {
				info.className = '';
			} else {
				info.className = 'open';
			}
		});

		setTimeout(function () {
			if (vrEffect.hmd()) {
				vrButton.disabled = false;
				//recordButton.disabled = false;
				//recordButton.addEventListener('click', startRecording, false);
			}
		}, 1);

		try {
			rec = JSON.parse(window.localStorage.getItem('hmdRecord'));
			duration = window.localStorage.getItem('recordingDuration');
			if (rec && rec.length && duration) {
				recordingDuration = duration;
				recordedMotion = rec;
				playButton.disabled = false;
			}
		} catch (e) {
		}

		if (!rec) {
			xhr = new XMLHttpRequest();
			xhr.onload = function () {
				var rec;
				try {
					rec = JSON.parse(this.responseText);
				} catch (e) {
					return;
				}
				if (rec && rec.length) {
					recordingDuration = rec[rec.length - 1].time + 1 / 60;
					recordedMotion = rec;
					playButton.disabled = false;
				}
			};
			xhr.open('get', 'data/recording.json', true);
			xhr.send();
		}
	}

	init();
	animate();
}());