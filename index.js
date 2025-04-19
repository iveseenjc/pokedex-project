function createElement (htmlTag, classes = [], attributes = {}, appendTo = null) {
	const element = document.createElement(htmlTag);

	if (classes.length > 0) {
		classes.forEach(c => {
			element.classList.add(c);
		});
	}

	for (const key in attributes) {
		element[key] = attributes[key]
	}

	if (appendTo !== null) {
		appendTo.append(element);
	}

	return element;
}

async function playTextToSpeech(text, voiceActor = "Mary", pitch = 1.0, volume = 0.7) {
	stopTextToSpeech(); 

	const voicesByLang = {
		"en-au": ["Zoe", "Isla", "Evie", "Jack"],
		"en-ca": ["Rose", "Clara", "Emma", "Mason"],
		"en-gb": ["Alice", "Nancy", "Lily", "Harry"],
		"en-in": ["Eka", "Jai", "Ajit"],
		"en-ie": ["Oran"],
		"en-us": ["Linda", "Amy", "Mary", "John", "Mike"]
	};

	const voicesList = Object.fromEntries(
		Object.entries(voicesByLang).flatMap(([lang, names]) =>
			names.map(name => [name, lang])
		)
	);

	const searchParams = new URLSearchParams({
		key: "69ce1bd863e645349bafdf0108128040",
		src: text,
		hl: voicesList[voiceActor],
		v: voiceActor,
		r: "0",
		c: "wav",
		f: "16khz_16bit_stereo"
	});

	try {
		const response = await fetch(`https://api.voicerss.org/?${searchParams}`);
		const arrayBuffer = await response.arrayBuffer();
		const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);

		const source = audioContext.createBufferSource();
		const gain = audioContext.createGain();

		source.buffer = decodedAudio;
		source.playbackRate.value = pitch;
		gain.gain.value = volume;

		source.connect(gain);
		gain.connect(audioContext.destination);
		source.start();

		activeTTS.source = source;
		activeTTS.gain = gain;
		activeTTS.isPlaying = true;

		source.onended = () => {
			stopTextToSpeech();
		};

	} catch (error) {
		console.error("TTS Error:", error);
		stopTextToSpeech(); 
	}
}

function stopTextToSpeech() {
	if (activeTTS.source) {
		try {
			activeTTS.source.stop(0);
		} catch (e) {
			console.warn("Already stopped:", e);
		}

		activeTTS.source.disconnect();
		activeTTS.gain.disconnect();
	}

	activeTTS.source = null;
	activeTTS.gain = null;
	activeTTS.isPlaying = false;
}

async function getPokemonInfos(offset = 0, limit = 20) {
	try {
		const pokeApi = `https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`;
		const pokemonUrls = await fetch(pokeApi).then(res => res.json()).then(data => data.results);

		return await Promise.all(
			pokemonUrls.map(url =>
				fetch(url.url).then(res => res.json()).then(async data => ({
					id: data.id,
					name: data.name,
					types: data.types,
					flavorText: await fetch(data.species.url)
						.then(res => res.json())
						.then(data => data.flavor_text_entries),
					sprites: {
						front_default: data.sprites.front_default,
						icon: data.sprites["versions"]["generation-viii"]["icons"].front_default,
					},
					cries: data.cries
				}))
			)
		);
	} 
	catch (e) {
		console.error('Error fetching pokemon data:', e);
		return [];
	}
}

function renderPokemonList(pokemonsChunk) {
	const pokemonListElement = document.querySelector("ul.pokemon-list");
	const fragment = document.createDocumentFragment();

	for (let i = 0; i < pokemonsChunk.length; i++) {
		const pokemon = pokemonsChunk[i];

		const li = createElement("li");
		li.setAttribute("data-pokemon-id", pokemon.id);
		li.title = capitalizeFirstLetter(pokemon.name);

		createElement("img", [], {
			src: pokemon.sprites.icon,
			alt: pokemon.name,
			loading: "lazy"
		}, li);

		createElement("p", [], {
			textContent: `No. ${pokemon.id.toString().padStart(3, '0')}`
		}, li);

		createElement("p", [], {
			textContent: pokemon.name
		}, li);
		
		fragment.append(li);
	}

	pokemonListElement.append(fragment); 
}

async function loadInitialPokemon() {
	isLoading = true;
	
	const newPokemons = await getPokemonInfos(offset, limit);
	pokemonList.push(...newPokemons);
	renderPokemonList(newPokemons);

	const adjustedLimit = Math.min(limit, maxPokemonCount - offset);
	offset += adjustedLimit;
	
	isLoading = false;

	if (newPokemons.length < limit) {
		allLoaded = true;
	}
}
async function playSpeechWithColorFeedback(
	button,
	text,
	voice,
	pitch = 1.15,
	volume = 0.5,
	color = "limegreen",
	resetColor = "",
	modifyBackground = false
) {
	if (!modifyBackground) {
		button.style.color = color;
	} else {
		button.style.backgroundColor = color;
	}

	const resetElementColors = () => {
		if (!modifyBackground) {
			button.style.color = resetColor;
		} else {
			button.style.backgroundColor = resetColor;
		}
	};

	return new Promise(resolve => {
		playTextToSpeech(text, voice, pitch, volume).then(() => {
			if (activeTTS.source) {
				activeTTS.source.onended = () => {
					stopTextToSpeech();
					resetElementColors();
					resolve(); 
				};
			} else {
				resetElementColors();
				resolve();
			}
		}).catch(() => {
			resetElementColors();
			resolve();
		});
	});
}

function createAudioWithControls(src = "", volume = 0.5, looping = false) {
	const audio = new Audio(src);

	audio.stopSound = function () {
		this.pause();
		this.currentTime = 0;
	};

		audio.muteSound = function () {
		this.pause();
	};

	audio.playSound = function () {
		this.play();
	};

	audio.setLoop = function (shouldLoop) {
		this.loop = shouldLoop;
	};

	audio.setVolume = function (value) {
		this.volume = Math.max(0, Math.min(1, value));
	};

	audio.setVolume(volume);
	audio.setLoop(looping);
	return audio;
}

const sfxAudio = {
	"select_sfx": createAudioWithControls("audio/sound_effects/select_sfx.mp3", 0.55),
	"error_sfx": createAudioWithControls("audio/sound_effects/error_sfx.wav", 0.3),
	"upwards_melody": createAudioWithControls("audio/sound_effects/upwards_melody.wav", 0.55),
	"downwards_melody": createAudioWithControls("audio/sound_effects/downwards_melody.wav", 0.7),
	"pokemon_cry": createAudioWithControls("", 0.125),
	"withdraw": createAudioWithControls("audio/sound_effects/withdraw_sfx.wav", 0.25)
};

const musicAudio = {
	"title_opening": createAudioWithControls("audio/music/title_screen_theme_opening.wav", 0.045), 
	"title_looped": createAudioWithControls("audio/music/title_screen_theme_looped.wav", 0.045, true)
};

function playBackgroundMusic() {
	const loopedMusic = musicAudio["title_looped"];
	const introMusic = musicAudio["title_opening"];

	if (loopedMusic.currentTime <= 0) {
		introMusic.playSound();

		introMusic.addEventListener("ended", () => {
			loopedMusic.playSound();
		}, { once: true });
	}
	else {
		loopedMusic.playSound();
	}
}

const audioContext = new AudioContext();

let activeTTS = {
	source: null,
	gain: null,
	isPlaying: false
};

let offset = 0;
const limit = 20;
const maxPokemonCount = 898;
const pokemonList = [];
let isLoading = false;
let allLoaded = false;

let currentLiSelected;

const pokemonListScreen = document.querySelector(".pokemon-list-screen");
const splashScreen = document.querySelector(".splash-screen");
const pressStartButton = splashScreen.querySelector("button");
const speakDescription = document.querySelector(".speak-description");
const descriptionScreen = document.querySelector(".description-screen");
const voiceSelect = document.querySelector("#voiceSelect");
const toggleMusic = document.querySelector(".toggle-music");
const toggleLegacyCries = document.querySelector(".toggle-legacy-cries");
const pokemonListElement = document.querySelector("ul.pokemon-list");
const testSpeech = document.querySelector(".test-speech");
const projectExplanation = document.querySelector(".project-explanation");
const toggleExplanation = document.querySelector(".toggle-explanation");
let useLegacyCries = false;

loadInitialPokemon();

toggleExplanation.addEventListener("click", () => {
	if (projectExplanation.style.display === "none") {
		sfxAudio["select_sfx"].playSound();
		projectExplanation.style.display = "block";
	}
	else {
		sfxAudio["withdraw"].playSound();
		projectExplanation.style.display = "none";
	}
});

projectExplanation.addEventListener("click", (e) => {
	const close = e.target.closest(".close");
	
	if (close) {
		sfxAudio["withdraw"].playSound();
		projectExplanation.style.display = "none";
	}
})

testSpeech.addEventListener("click", () => {
	if (activeTTS.source) {
		stopTextToSpeech();
		testSpeech.style.backgroundColor = "orangered";
		sfxAudio["withdraw"].playSound();
		return;
	}
	
	const liElements = [...projectExplanation.querySelectorAll("li")];
	const text = liElements.map(li => li.innerText).join(' ');
	sfxAudio["select_sfx"].playSound();

	playSpeechWithColorFeedback(testSpeech, text, voiceSelect.value, 1.15, 0.5, "green", "orangered", true);
});

pokemonListElement .addEventListener("click", (e) => {
	const li = e.target.closest("li[data-pokemon-id]");
	speakDescription.textContent = "Evaluate Pokemon";
	
	if (li) {
		onLiClicked(li);
	} 
});

toggleLegacyCries.addEventListener("click", () => {
	useLegacyCries = !useLegacyCries;
	
	if (useLegacyCries) {
		sfxAudio["upwards_melody"].playSound();
		toggleLegacyCries.style.color = "green"
	}
	else {
		sfxAudio["downwards_melody"].playSound();
		toggleLegacyCries.style.color = "peru"
	}
});

voiceSelect.addEventListener("mousedown", () => {
	sfxAudio["upwards_melody"].playSound();
});

voiceSelect.addEventListener("change", () => {
	sfxAudio["downwards_melody"].playSound()
	stopTextToSpeech();
});

toggleMusic.addEventListener("click", () => {
	if (!musicAudio["title_looped"].paused || !musicAudio["title_opening"].paused) {
		sfxAudio["downwards_melody"].playSound();
		musicAudio["title_opening"].muteSound();
		musicAudio["title_looped"].muteSound();
	}
	else {
		sfxAudio["upwards_melody"].playSound();
		playBackgroundMusic();
	}
});

pressStartButton.addEventListener("click", () => {
	if (audioContext.state === "suspended") {
		audioContext.resume();
	}
	
	playBackgroundMusic();
	sfxAudio["select_sfx"].playSound();
	splashScreen.style.display = "none";
});

speakDescription.addEventListener("click", async () => {
	if (activeTTS.source) {
		stopTextToSpeech();
		speakDescription.style.color = "peru";
		speakDescription.textContent = "Evaluate Pokemon";
		sfxAudio["withdraw"].playSound();
		return;
	}

	if (descriptionScreen.textContent !== "") {
		sfxAudio["select_sfx"].playSound();
		speakDescription.textContent = "Stop Evaluating";

		await playSpeechWithColorFeedback(
			speakDescription,
			descriptionScreen.textContent,
			voiceSelect.value,
			1.15,
			0.5,
			"green",
			"peru"
		);

		speakDescription.textContent = "Evaluate Pokemon";
	} else {
		sfxAudio["error_sfx"].playSound();
		speakDescription.style.color = "red";
		setTimeout(() => speakDescription.style.color = "peru", 500);
	}
});

pokemonListScreen.addEventListener("scroll", async () => {
	if (isLoading || allLoaded) return;

	const threshold = 700; 
	const { scrollTop, scrollHeight, clientHeight } = pokemonListScreen;

	if (scrollHeight - scrollTop - clientHeight <= threshold) {
		await loadInitialPokemon();
	}
});

function onLiClicked(li) {

	const id = li.getAttribute("data-pokemon-id");
	
	if (currentLiSelected !== undefined) {
		currentLiSelected.classList.toggle("selected", false);
	}
	
	updateDetailsScreen(id);
	
	currentLiSelected = li;
	li.classList.toggle("selected", true);
	sfxAudio["select_sfx"].playSound();
}

function capitalizeFirstLetter(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateDetailsScreen(pokemonId) {
	function formatPokedexDescription(pokemonData) {
		const name = capitalizeFirstLetter(pokemonData.name);

		const filteredTypes = pokemonData.types
			.map(t => t.type.name)
			.filter(type => type !== "normal");

		let typeText;

		if (filteredTypes.length === 0) {
			typeText = "Normal-type Pokémon";
		} else {
			const typeNames = filteredTypes.map(type => capitalizeFirstLetter(type));
			const joinedTypes = typeNames.join(" and ");
			typeText = `${joinedTypes}-type Pokémon`;
		}

		const flavorEntries = pokemonData.flavorText.filter(entry => entry.language.name === "en");
		const uniqueFlavorTexts = [...new Set(flavorEntries.map(entry => entry.flavor_text.replace(/[\n\f\r]+/g, ' ').trim()))];

		const flavorText = uniqueFlavorTexts[0] || "No flavor text available.";

		return `${name}, the ${typeText}. ${flavorText}`;
	}

	const pokemonSprite = document.querySelector(".pokemon-sprite");
	const pokemonData = pokemonList[pokemonId - 1];

	stopTextToSpeech();
	
	const crySfx = sfxAudio["pokemon_cry"];
	crySfx.muteSound();
	crySfx.src = pokemonData.name === "pikachu" || useLegacyCries 
		? pokemonData.cries.legacy 
		: pokemonData.cries.latest;
	console.log(crySfx.src);
	crySfx.playSound();
	
	pokemonSprite.src = pokemonData.sprites.front_default;
	descriptionScreen.textContent = formatPokedexDescription(pokemonData)
	
	descriptionScreen.style.display = "block";
	pokemonSprite.style.display = "block";
}