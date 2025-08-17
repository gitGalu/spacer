import './App.css';
import '@egjs/react-flicking/dist/flicking.css';
import 'leaflet/dist/leaflet.css';
import React from 'react';
import * as turf from '@turf/turf';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, TileLayer, useMapEvents, GeoJSON, ZoomControl } from 'react-leaflet';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { Provider as StyletronProvider } from 'styletron-react';
import { Client as Styletron } from 'styletron-engine-atomic';
import { BaseProvider, DarkTheme } from 'baseui';
import { Button, SHAPE } from 'baseui/button';
import { ANCHOR, Drawer, SIZE } from 'baseui/drawer';
import { ProgressBarRounded } from 'baseui/progress-bar';
import { Tag, VARIANT, KIND } from 'baseui/tag';
import { ProgressSteps, NumberedStep } from 'baseui/progress-steps';
import { Select } from 'baseui/select';
import { Shake } from 'reshake';
import Flicking from '@egjs/react-flicking';
import { Fade, Perspective } from '@egjs/flicking-plugins';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import ConfettiExplosion from 'react-confetti-explosion';
import db from './Db';
import packageJson from '../package.json';

const MAX_DISTANCE = 50;
const ENERGY_VALUES = {
  survival: { wrong: -5, correct: +5 },
  revival: { wrong: -10, correct: +2 }
};

const engine = new Styletron();

const myIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

const isStandalone = () => {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  return (window.matchMedia('(display-mode: standalone)').matches);
}

function App() {
  const { t } = useTranslation();

  const gameModeSelect = [
    { label: t('game_mode_classic'), desc: t('game_mode_classic_desc'), id: 'classic' },
    { label: t('game_mode_penalty'), desc: t('game_mode_penalty_desc'), id: 'penalty' }
  ];

  const scenarioSelect = [
    { label: 'Gdynia #1', id: './scenarios/gdy1.json', type: 'local' },
    { label: t('select_scenario_2'), id: 'import' }
  ];

  const [permission, setPermission] = React.useState(null);
  const importEl = React.useRef(null);
  const [current, setCurrent] = React.useState(isStandalone() ? 1 : 0);
  const [startingAreaLoading, setStartingAreaLoading] = React.useState(false);
  const [scenario, setScenario] = React.useState(null);
  const [isDrawerOpen, setDrawerOpen] = React.useState(false);
  const [stepperScenario, setStepperScenario] = React.useState(scenarioSelect);
  const [selectedStepperScenario, setSelectedStepperScenario] = React.useState(null);
  const [selectedStepperArea, setSelectedStepperArea] = React.useState(null);
  const [selectedGameMode, setSelectedGameMode] = React.useState(null);
  const [startGameEnabled, setStartGameEnabled] = React.useState(null);
  const [importedScenario, setImportedScenario] = React.useState(null);
  const [isImageVisible, setImageVisible] = React.useState(false);
  const [userLocation, setUserLocation] = React.useState(null);
  const scenarioSelectRef = React.useRef(null);
  const flickingRef = React.useRef(null);
  const [shakeActive, setShakeActive] = React.useState(false);
  const [explosionActive, setExplosionActive] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [buttonsEnabled, setButtonsEnabled] = React.useState(true);
  const [tutorialState, setTutorialState] = React.useState(0);
  const [showWinAnimation, setShowWinAnimation] = React.useState(false);
  const [isAreaMapOpen, setAreaMapOpen] = React.useState(false);
  const [tempSelectedArea, setTempSelectedArea] = React.useState(null);
  const mapRef = React.useRef(null);

  const [stage, setStage] = React.useState(() => {
    const savedValue = localStorage.getItem('stage');
    return savedValue !== null ? savedValue : "splash";
  });

  React.useEffect(() => {
    localStorage.setItem('stage', stage);
    
    if (stage === "win") {
      setShowWinAnimation(false);
      const timer = setTimeout(() => {
        setShowWinAnimation(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowWinAnimation(false);
    }
  }, [stage]);

  const [energy, setEnergy] = React.useState(() => {
    const savedValue = localStorage.getItem('energy');
    return savedValue !== null ? parseFloat(savedValue) : 100;
  });
  React.useEffect(() => {
    localStorage.setItem('energy', energy);
  }, [energy]);

  const [progress, setProgress] = React.useState(() => {
    const savedValue = localStorage.getItem('progress');
    return savedValue !== null ? savedValue : 0;
  });
  React.useEffect(() => {
    localStorage.setItem('progress', progress);
  }, [progress]);

  const [currentImage, setCurrentImage] = React.useState();

  const setImageData = (key, unlocked, guessed) => {
    const data = { "unlocked": unlocked, "guessed": guessed };
    localStorage.setItem('img_' + key, JSON.stringify(data));
  }

  const getImageData = (key) => {
    return JSON.parse(localStorage.getItem('img_' + key));
  }

  const plugins = [new Fade(), new Perspective({ rotate: 0.2, scale: 0.2 })];

  const reset = () => {
    localStorage.clear();
    setCurrent(1);
    setSelectedStepperArea(null);
    setSelectedGameMode(null);
    setStartGameEnabled(null);
    setScenario(null);
    setImageVisible(false);
    setCurrentImage(undefined);
    setEnergy(100);
    setProgress(0);
    setDrawerOpen(false);
    setStage("splash");
    db.delete().then(() => {
      // window.location.reload();
    }).catch((error) => {
      console.log('An error occurred while deleting the database:', error);
    });

  }

  React.useEffect(() => {
    if (stage === "game" || stage === "win") {
      loadFromDb();
    }

    if (("geolocation" in navigator)) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermission(null);
        },
        (error) => {
          setPermission(error.message);
        }
      );
    } else {
      setPermission('unavailable');
    }


    const handleClick = (e) => {
      if (e.target.closest('.leaflet-container')) {
        return;
      }
      updateLocation();
    };
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  function MapEvents() {
    const map = useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
      },
    });
    
    React.useEffect(() => {
      if (map) {
        mapRef.current = map;
      }
    }, [map]);
    
    return null;
  }

  const updateLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        if (mapRef.current != null) {
          mapRef.current.setView([latitude, longitude]);
        }
      }
    );
  }

  function havesine(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371000; // Earth's radius in meters
    const dLat = degToRad(lat2 - lat1);
    const dLon = degToRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadius * c;
    return distance;
  }

  function degToRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  const userGuess = (cheat) => {
    if (process.env.REACT_APP_DEV_MODE === 'true') {
      console.log('userGuess called - currentImage:', currentImage, 'buttonsEnabled:', buttonsEnabled);
    }
    setButtonsEnabled(false);
    
    const availableImages = scenario.images.filter((image) => {
      const data = getImageData(image.id);
      return data && data.unlocked && !data.guessed;
    });
    
    const target = availableImages.find(item => 
      item.id === currentImage || item.id === parseInt(currentImage) || item.id.toString() === currentImage
    );
    if (!target) { 
      if (process.env.REACT_APP_DEV_MODE === 'true') {
        console.log('CurrentImage not found in available images. CurrentImage:', currentImage);
        console.log('Available image IDs:', availableImages.map(img => img.id));
        if (availableImages.length > 0) {
          console.log('Auto-fixing: setting currentImage to:', availableImages[0].id);
          setCurrentImage(availableImages[0].id);
        }
      }
      setButtonsEnabled(true); 
      return; 
    }
    
    const currentImageData = getImageData(currentImage);
    if (process.env.REACT_APP_DEV_MODE === 'true') {
      console.log('currentImageData:', currentImageData);
    }
    if (currentImageData && currentImageData.guessed) {
      if (process.env.REACT_APP_DEV_MODE === 'true') {
        console.log('Image already guessed, returning early');
      }
      setButtonsEnabled(true);
      return;
    }
    const distance = havesine(userLocation[0], userLocation[1], target.lat, target.lon);
    setTutorialState(tutorialState + 2);
    if (cheat || distance < MAX_DISTANCE) {
      setExplosionActive(true);
      setTimeout(() => { setExplosionActive(false) }, 2500);
      setImageData(currentImage, true, true);
      
      const gameMode = localStorage.getItem('gameMode');
      if (gameMode === 'penalty') {
        addNewImage();
        addNewImage();
        addNewImage();
      } else {
        // Survival Mode
      }
      
      updateScore();
      gainEnergy();
      
      const availableImages = scenario.images.filter(image => {
        if (image.id === currentImage) return false; // skip the just-guessed image
        const data = getImageData(image.id);
        return data && data.unlocked && !data.guessed;
      });
      
      if (availableImages.length > 0) {
        const nextUnguessedImage = availableImages[0];
        setCurrentImage(nextUnguessedImage.id);
        
        if (flickingRef.current) {
          flickingRef.current.moveTo(0);
        }
      }
      
      setMessage(t('good_answer'));
      // setMessage(distance);
    } else {
      setShakeActive(true);
      setTimeout(function () { setShakeActive(false) }, 1500);
      loseEnergy();
      setMessage(t('wrong_answer'));
      // setMessage(distance);
    }
    evaluateResult();
    setTimeout(() => { setDrawerOpen(false); setButtonsEnabled(true); }, 1500);
  }

  const evaluateResult = () => {
    if (progress >= 1) {
      setStage("win");
    }
  }

  const loseEnergy = () => {
    const gameMode = localStorage.getItem('gameMode');
    const energyLoss = gameMode === 'classic' ? ENERGY_VALUES.survival.wrong : ENERGY_VALUES.revival.wrong;
    
    var newEnergy = energy + energyLoss;
    if (newEnergy < 0) {
      newEnergy = 0;
    }
    setEnergy(newEnergy);

    if (newEnergy === 0) {
      if (gameMode === 'classic') {
        setStage("gameOver");
      } else if (gameMode === 'penalty') {
        resetHalfGuessedImages();
        setStage("energyPenalty");
      }
    }
  }

  const gainEnergy = () => {
    const gameMode = localStorage.getItem('gameMode');
    const energyGain = gameMode === 'classic' ? ENERGY_VALUES.survival.correct : ENERGY_VALUES.revival.correct;
    
    var newEnergy = energy + energyGain;
    if (newEnergy > 100) {
      newEnergy = 100;
    }
    setEnergy(newEnergy);
  }

  const resetHalfGuessedImages = () => {
    if (!scenario) return;
    
    const guessedImages = scenario.images.filter((image) => {
      const data = getImageData(image.id);
      return data && data.guessed;
    });

    const imagesToReset = Math.ceil(guessedImages.length / 2);
    
    const shuffled = [...guessedImages].sort(() => 0.5 - Math.random());
    const imagesToResetList = shuffled.slice(0, imagesToReset);
    
    imagesToResetList.forEach(image => {
      const currentData = getImageData(image.id);
      setImageData(image.id, currentData.unlocked, false);
    });

    updateScore();
  }



  const updateScore = () => {
    let guessedItems = scenario.images.filter((image) => {
      const data = getImageData(image.id);
      return data.guessed;
    });
    let percentage = guessedItems.length / scenario.images.length;
    setProgress(percentage);
  }

  const addNewImage = () => {
    let selectableObjects = scenario.images
      .filter((image) => {
        const data = getImageData(image.id);
        return !data.unlocked;
      })

    if (selectableObjects.length === 0) { return };

    var randomIndex = Math.floor(Math.random() * selectableObjects.length);
    var randomImage = selectableObjects[randomIndex];
    setImageData(randomImage.id, true, false);
  }

  function SpacedButton(props) {
    return (
      <Button
        {...props}
        shape={SHAPE.pill}
        kind={KIND.secondary}
        size={SIZE.compact}
        overrides={{
          BaseButton: {
            style: ({ $theme }) => ({
              marginLeft: $theme.sizing.scale200,
              marginRight: $theme.sizing.scale200,
              marginTop: $theme.sizing.scale800,
            }),
          },
        }}
      />
    );
  }

  const fetchScenario = async (path) => {
    setStartingAreaLoading(true);
    path = selectedStepperScenario[0].id;
    try {
      const response = await fetch(path);
      if (response.ok) {
        const content = await response.text();
        const jsonObject = JSON.parse(content);

        const newScenario = {
          id: jsonObject.id,
          scenario_title: jsonObject.scenario_title,
          scenario_author: jsonObject.scenario_author,
          scenario_description: jsonObject.scenario_description,
          images: jsonObject.images,
          areas: jsonObject.areas
        };
        setScenario(newScenario);
        setStartingAreaLoading(false);
      } else {
        throw new Error('File not found');
      }
    } catch (error) {
      //TODO
      console.error(error);
    }
  };

  const loadFromDb = async () => {
    const loadScenario = await db.scenario.toArray();
    setScenario(loadScenario[0]);
    
    if (loadScenario[0] && !currentImage) {
      const firstUnlockedImage = loadScenario[0].images.find(image => {
        const data = getImageData(image.id);
        return data && data.unlocked && !data.guessed;
      });
      if (firstUnlockedImage) {
        setCurrentImage(firstUnlockedImage.id);
      }
    }
  }

  const setupGame = () => {
    scenario.id = 0;

    setTutorialState(0);
    setMessage(t('instructions_1'));

    localStorage.setItem('gameMode', selectedGameMode[0].id);

    db.scenario.add(scenario)
      .then(() => {
        // OK
      })
      .catch(error => {
        console.error('Error storing object:', error);
      });

    for (const image of scenario.images) {
      setImageData(image.id, image.area === selectedStepperArea[0].id, false);
    }

    const firstUnlockedImage = scenario.images.find(image => 
      image.area === selectedStepperArea[0].id
    );
    
    if (firstUnlockedImage) {
      setCurrentImage(firstUnlockedImage.id);
    }
  }

  const handleImport = (event) => {
    const file = event.target.files[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = function (e) {
        const content = e.target.result;
        processImport('own', content);
      };

      reader.readAsText(file);
    }
  }

  const processImport = (id, content) => {
    let jsonObject;
    try {
      jsonObject = JSON.parse(content);

      const newScenario = {
        id: id,
        scenario_title: jsonObject.scenario_title,
        scenario_author: jsonObject.scenario_author,
        scenario_description: jsonObject.scenario_description,
        images: jsonObject.images,
        areas: jsonObject.areas
      };

      //TODO validate imported scenario
      if (id === 'own') {
        const newStepperScenario = { label: newScenario.scenario_title, id: newScenario.id, type: 'memory' };
        setStepperScenario([newStepperScenario, ...scenarioSelect]);
        setImportedScenario(newScenario);

        scenarioSelectRef.current && scenarioSelectRef.current.setInputValue('')
        scenarioSelectRef.current && scenarioSelectRef.current.setDropdownOpen(true);
      }
    } catch (e) {
      console.error('The selected file does not contain valid JSON.', e);
    }
  }

  const getAreaName = (position) => {
    if (position === null || scenario === null || scenario.areas === null) {
      return <>&shy;</>;
    }
    for (const area of scenario.areas) {
      let geometry = area.coords.geometry;
      if (isInBounds(position, geometry)) { return area.name; }
    }
    return <>&shy;</>;
  }

  const isInBounds = (position, area) => {
    const pointToCheck = turf.point([position[1], position[0]]);

    if (turf.booleanPointInPolygon(pointToCheck, area)) {
      return true;
    }
    return false;
  }

  const renderWin = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'black',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        paddingBottom: '40px'
      }}>
        {showWinAnimation && scenario && scenario.images && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            zIndex: 1
          }}>
            {scenario.images.slice(0, 6).map((image, index) => (
              <img
                key={image.id}
                src={image.data}
                alt=""
                style={{
                  position: 'absolute',
                  width: '50vw',
                  height: '35vh',
                  objectFit: 'cover',
                  opacity: 0,
                  borderRadius: '12px',
                  animation: `slideImages 15s infinite ${index * 4}s`,
                  transform: 'translateX(-150vw) translateY(-30vh) scale(0.3) rotate(-15deg)',
                }}
              />
            ))}
          </div>
        )}
        
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', alignItems: 'center' }}>
          <ConfettiExplosion />
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ 
                color: 'green', 
                margin: '0 0 16px 0',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.6)'
              }}>{t('congratulations')}</h2>
              <p style={{ 
                color: 'white', 
                margin: 0,
                textShadow: '2px 2px 4px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.6)'
              }}>{t('you_won')}</p>
            </div>
          </div>
          
          <div style={{ width: '100%', maxWidth: '300px' }}>
            <Button className={'btn'} onClick={() => reset()}>
              {t('play_again')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const renderGameOver = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#00000022',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        paddingBottom: '40px'
      }}>
        <div></div>
        
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'red', margin: '0 0 16px 0' }}>{t('game_over')}</h2>
          <p style={{ color: 'white', margin: 0 }}>{t('energy_depleted')}</p>
          <p style={{ color: 'white', margin: '8px 0 0 0' }}>{t('game_over_desc')}</p>
        </div>
        
        <div style={{ width: '100%', maxWidth: '300px' }}>
          <Button className={'btn'} onClick={() => reset()}>
            {t('try_again')}
          </Button>
        </div>
      </div>
    );
  }

  const renderEnergyPenalty = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#00000022',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px',
        paddingBottom: '40px'
      }}>
        <div></div>
        
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'orange', margin: '0 0 16px 0' }}>{t('energy_penalty')}</h2>
          <p style={{ color: 'white', margin: 0 }}>{t('energy_penalty_desc')}</p>
          <p style={{ color: 'white', margin: '8px 0 0 0' }}>{t('energy_restored')}</p>
        </div>
        
        <div style={{ width: '100%', maxWidth: '300px' }}>
          <Button className={'btn'} onClick={() => { 
            setEnergy(50);
            
            const firstAvailableImage = scenario.images.find(image => {
              const data = getImageData(image.id);
              return data && data.unlocked && !data.guessed;
            });
            
            if (firstAvailableImage) {
              setCurrentImage(firstAvailableImage.id);
              if (flickingRef.current) {
                flickingRef.current.moveTo(0);
              }
            }
            
            setStage("game"); 
            setDrawerOpen(false); 
          }}>
            {t('continue_playing')}
          </Button>
        </div>
      </div>
    );
  }

  const handleFocus = (event) => {
    event.target.blur();
  };

  const renderAreaMapDrawer = () => {
    return (
      <Drawer
        overrides={{
          DrawerContainer: {
            style: ({ $theme }) => ({
              backgroundColor: '#00000022',
              backdropFilter: 'blur(6px)'
            })
          }
        }}
        isOpen={isAreaMapOpen}
        autoFocus
        closeable={true}
        onClose={() => {
          setAreaMapOpen(false);
          setTempSelectedArea(null);
        }}
        anchor={ANCHOR.bottom}
        size={SIZE.full}>
        <div style={{ position: 'relative', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
          <h3 style={{ color: 'white', textAlign: 'center', margin: '0 0 16px 0' }}>
            {t('select_starting_area')}
          </h3>
          <div style={{ position: 'absolute', top: '64px', left: '16px', right: '16px', bottom: '164px', borderRadius: '8px', overflow: 'hidden' }}>
            <MapContainer 
              center={[54.5128517, 18.5452861]} 
              zoom={12} 
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>'
                url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                minZoom={0}
                maxZoom={20}
              />
              {scenario != null && scenario.areas.map((area) => {
                const isSelected = tempSelectedArea && area.id === tempSelectedArea.id;
                
                return (
                  <GeoJSON
                    key={area.id}
                    data={area.coords}
                    style={() => ({
                      color: isSelected ? '#276EF1' : 'lightpink',
                      weight: isSelected ? 4 : 3,
                      opacity: 1,
                      fillOpacity: 0.1,
                    })}
                    eventHandlers={{
                      click: () => {
                        setTempSelectedArea(area);
                      }
                    }}
                  />
                );
              })}
              <ZoomControl position="bottomright" />
            </MapContainer>
          </div>
          <div style={{ position: 'absolute', bottom: '120px', left: '16px', right: '16px', textAlign: 'center', color: 'white', minHeight: '24px', paddingTop: '12px', paddingBottom: '8px' }}>
            {tempSelectedArea ? tempSelectedArea.name : t('select_starting_area_1')}
          </div>
          <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px' }}>
            <div style={{ marginBottom: '8px' }}>
              <Button 
                className={'btn'} 
                disabled={!tempSelectedArea}
                onClick={() => {
                  if (tempSelectedArea) {
                    setSelectedStepperArea([tempSelectedArea]);
                  }
                  setAreaMapOpen(false);
                  setTempSelectedArea(null);
                }}
                overrides={{
                  BaseButton: {
                    style: {
                      width: '100%'
                    }
                  }
                }}
              >
                {t('btn_use_this_area')}
              </Button>
            </div>
            <div>
              <Button 
                className={'btn'} 
                kind="secondary"
                onClick={() => {
                  setAreaMapOpen(false);
                  setTempSelectedArea(null);
                }}
                overrides={{
                  BaseButton: {
                    style: {
                      width: '100%'
                    }
                  }
                }}
              >
                {t('btn_cancel')}
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    );
  }

  const renderMenu = () => {
    return (<>
      {renderAreaMapDrawer()}
      <div style={{ 'paddingRight': '16px' }}>
        <div className={`background ${isImageVisible ? 'hide' : ''}`}></div>
        <div className={`background-image ${isImageVisible ? 'show' : ''}`}></div>
        <h3 className="stepper-heading">{t('app_name')}<sup style={{ fontSize: "50%" }}>v{packageJson.version}</sup></h3>
        <ProgressSteps current={current}
          overrides={{
            Content: {
              style: ({ $theme }) => ({
              })
            },
            Root: {
              style: ({ $theme }) => ({
                width: '80%',
              })
            }
          }}
        >
          <NumberedStep title={t('add_home_screen')}>
            <p className="stepper-paragraph">{t('add_home_screen_1')}</p>
            <p className="stepper-paragraph">{t('add_home_screen_2')}</p>
            <p className="stepper-paragraph">{t('add_home_screen_3')}</p>
          </NumberedStep>

          <NumberedStep title={t('select_scenario')} style={{ width: '100%' }} >
            <p className="stepper-paragraph">{t('select_scenario_1')}</p>
            <input ref={importEl} type="file" style={{ display: 'none' }} onChange={handleImport} />
            <div>
              <Select
                className="baseui-select"
                options={stepperScenario}
                controlRef={scenarioSelectRef}
                clearable={false}
                searchable={false}
                placeholder={t('select_placeholder')}
                labelKey="label"
                valueKey="id"
                onFocus={handleFocus}
                onChange={({ value }) => {
                  if (value.length === 0) {
                    setSelectedStepperScenario(null);
                    setSelectedStepperArea(null);
                    return;
                  }
                  if (value[0].id === 'import') {
                    importEl.current.click();
                  } else {
                    setSelectedStepperScenario(value);
                    setSelectedStepperArea(null);
                  }
                }}
                value={selectedStepperScenario}
              />
            </div>
            <SpacedButton disabled>{t('btn_back')}</SpacedButton>
            <SpacedButton disabled={selectedStepperScenario === null} onClick={() => {
              fetchScenario(selectedStepperScenario[0].scenario_id);
              setCurrent(2);
            }}>
              {t('btn_next')}
            </SpacedButton>
          </NumberedStep>

          <NumberedStep title={t('select_game_mode')}>
            <div>
              <Select
                options={gameModeSelect}
                placeholder={t('select_placeholder')}
                labelKey="label"
                valueKey="id"
                clearable={false}
                searchable={false}
                onFocus={handleFocus}
                onChange={({ value }) => {
                  setSelectedGameMode(value);
                }}
                value={selectedGameMode}
              />
            </div>
            {selectedGameMode && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                <p className="mode-description" style={{ margin: 0, fontSize: '14px', color: 'lightgray', lineHeight: '1.4' }}>
                  {selectedGameMode[0].id === 'classic' ? t('game_mode_classic_desc') : t('game_mode_penalty_desc')}
                </p>
              </div>
            )}
            <SpacedButton onClick={() => setCurrent(1)}>
              {t('btn_back')}
            </SpacedButton>
            <SpacedButton disabled={selectedGameMode === null} onClick={() => setCurrent(3)}>
              {t('btn_next')}
            </SpacedButton>
          </NumberedStep>

          <NumberedStep title={t('select_starting_area')} readonly>
            <p className="stepper-paragraph">
              {t('select_starting_area_1')}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <Select
                  readonly
                  options={scenario != null ? scenario.areas : []}
                  placeholder={t('select_placeholder')}
                  isLoading={startingAreaLoading}
                  disabled={startingAreaLoading}
                  labelKey="name"
                  valueKey="id"
                  noResultsMsg={t('select_starting_area_3')}
                  onFocus={handleFocus}
                  clearable={false}
                  searchable={false}
                  onChange={({ value }) => {
                    setSelectedStepperArea(value)
                  }}
                  value={selectedStepperArea}
                />
              </div>
              <Button
                shape={SHAPE.round}
                size="compact"
                disabled={!scenario || startingAreaLoading}
                onClick={() => setAreaMapOpen(true)}
                overrides={{
                  BaseButton: {
                    style: {
                      minWidth: '32px',
                      height: '32px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                    }
                  }
                }}
              >
                ⓘ
              </Button>
            </div>
            <SpacedButton onClick={() => setCurrent(2)}>
              {t('btn_back')}
            </SpacedButton>
            <SpacedButton disabled={selectedStepperArea === null} onClick={() => {
              setImageVisible(true);
              setStartGameEnabled(false);
              setCurrent(4);
              setTimeout(() => {
                setStartGameEnabled(true);
              }, 500)
            }}>
              {t('btn_next')}
            </SpacedButton>
          </NumberedStep>
          <NumberedStep title={t('start_game_title')}>
            <p className="stepper-paragraph">
              {t('start_game_1')}
            </p>
            <SpacedButton
              disabled={startGameEnabled === false}
              onClick={() => { setImageVisible(false); setCurrent(3) }}>
              {t('btn_back')}
            </SpacedButton>
            <SpacedButton
              disabled={startGameEnabled === false}
              onClick={() => {
                setupGame();
                setStage("game");
              }}>{t('btn_start')}</SpacedButton>
          </NumberedStep>
        </ProgressSteps>
      </div>
    </>)
  }

  const render = () => {
    switch (stage) {
      case "game":
        if (permission != null) {
          return renderPermission();
        } else {
          return renderGame();
        }
      case "win":
        return renderWin();
      case "gameOver":
        return renderGameOver();
      case "energyPenalty":
        return renderEnergyPenalty();
      case "splash":
        return renderMenu();
      default:
        return renderMenu();
    }
  }

  const renderPermission = () => {
    return <>
      <h3 className="stepper-heading">{t('app_name')}<sup style={{ fontSize: "50%" }}>v{packageJson.version}</sup></h3>
      <p>{t('location_permission_heading')}</p>
      <p>{t('location_permission_message_1')}</p>
    </>
  }

  const renderGame = () => {
    return <>
      <Drawer
        overrides={{
          DrawerContainer: {
            style: ({ $theme }) => ({
              backgroundColor: '#00000022',
              backdropFilter: 'blur(6px)'
            })
          }
        }}
        isOpen={isDrawerOpen}
        autoFocus
        closeable={false}
        onClose={() => setDrawerOpen(false)}
        anchor={ANCHOR.bottom}
        size={SIZE.full}>
        <div className="drawer-containerback" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="drawer-stat-row" style={{ marginBottom: '16px' }}>
            <Shake active={shakeActive} fixed={true} h={1} v={10} r={10} fixedStop={true} >
              {t('energy')}
              <ProgressBarRounded progress={energy / 100} animate={true} />
            </Shake>
            <div>
              <>{explosionActive && <ConfettiExplosion />}</>
              {t('progress')}
              <ProgressBarRounded progress={progress} animate={true} />
            </div>
          </div>
          <div className="drawer-map-row" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <MapContainer zoomControl={false} attributionControl={false} center={userLocation ? userLocation : [54.5128517, 18.5452861]} ref={mapRef} zoom={14} style={{ borderRadius: '8px', height: "100%", width: "100%", flex: 1, marginTop: '16px' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                minZoom={0}
                maxZoom={20}
              />
              {scenario != null && scenario.areas.map((area) => {
                const currentImageData = scenario.images.find(img => img.id == currentImage);
                const isTargetArea = currentImageData && area.id === currentImageData.area;
                const isCurrentLocation = userLocation && area && isInBounds(userLocation, area.coords);
                
                if (process.env.REACT_APP_DEV_MODE === 'true') {
                  console.log(`Area ${area.id}: currentImage=${currentImage}, found=${!!currentImageData}, isTarget=${isTargetArea}`);
                }
                
                return (
                  <GeoJSON
                    key={`${area.id}-${currentImage}`}
                    data={area.coords}
                    style={() => ({
                      color: isTargetArea ? '#276EF1' : (isCurrentLocation ? 'deeppink' : 'lightpink'),
                      weight: 3,
                      opacity: isTargetArea ? 1 : (isCurrentLocation ? 1 : 0.7),
                    })}
                    className={isTargetArea ? 'target-area-pulse' : ''}
                  />
                );
              })}
              {userLocation &&
                <Marker position={userLocation} icon={myIcon}>
                </Marker>}
              <ZoomControl position="bottomleft" />
              <MapEvents />
            </MapContainer>
            <div style={{ marginTop: '8px', marginBottom: '8px', color: 'deeppink', textAlign: 'center' }}>
              {
                getAreaName(userLocation)
              }
            </div>
          </div>
          <div className="drawer-buttons-row" style={{ flexShrink: 0, padding: '16px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <Button className={'btn'} disabled={!buttonsEnabled} onClick={() => { updateLocation(); }}>{t('location_refresh')}</Button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Button className={'btn'} disabled={!buttonsEnabled || userLocation === null} onClick={() => { userGuess(false); }}>{t('photo_here')}</Button>
            </div>
            <div>
              <Button className={'btn'} disabled={!buttonsEnabled} onClick={() => { setDrawerOpen(false); }}>{t('close_menu')}</Button>
            </div>
            {/* Dev mode buttons */}
            {process.env.REACT_APP_DEV_MODE === 'true' && (
              <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
                <p style={{ fontSize: '12px', color: '#ff6666', margin: '5px 0' }}>{t('dev_testing_label')}</p>
                <div style={{ marginBottom: '8px' }}>
                  <Button className={'btn'} size="compact" onClick={() => setStage("gameOver")}>{t('test_game_over')}</Button>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <Button className={'btn'} size="compact" onClick={() => { 
                    resetHalfGuessedImages(); 
                    setStage("energyPenalty"); 
                  }}>{t('test_energy_penalty')}</Button>
                </div>
                <div>
                  <Button className={'btn'} size="compact" onClick={() => setStage("win")}>{t('test_game_completed')}</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Drawer>
      <Flicking
        ref={flickingRef}
        plugins={plugins}
        align="prev"
        circular={true}
        onChanged={(e) => {
          const panelEl = (e.currentTarget.getPanel(e.index)).element;
          const imageEl = panelEl.querySelector('img');
          const extraData = imageEl.dataset.extra;
          if (process.env.REACT_APP_DEV_MODE === 'true') {
            console.log('Flicking onChanged - setting currentImage to:', extraData, 'type:', typeof extraData);
            
            const availableImages = scenario.images.filter((image) => {
              const data = getImageData(image.id);
              return data && data.unlocked && !data.guessed;
            });
          }
          setCurrentImage(extraData);
          if (tutorialState === 0) { setMessage(t('instructions_1')); setTutorialState(tutorialState + 1); }
          else if (tutorialState === 1) { setMessage(t('instructions_2')); setTutorialState(tutorialState + 1); }
          else {
            setMessage('');
          }
        }}>
        {scenario != null && (() => {
          const availableImages = scenario.images.filter((image) => {
            const data = getImageData(image.id);
            return data.unlocked && !data.guessed;
          });
          if (process.env.REACT_APP_DEV_MODE === 'true') {
            console.log('Available images for swiping:', availableImages.length);
          }
          return availableImages.map((image) =>
            <div className="panel">
              <div className="image-container">
                <img src={image.data} data-extra={image.id} className="responsive-image" onClick={() => {
                  setDrawerOpen(true);
                  setTutorialState(3);
                  setMessage(null);
                }}></img>
                <div className="overlay-text">
                  <Tag kind={KIND.white} closeable={false} variant={VARIANT.light}>
                    {scenario.areas.find(area => area.id === image.area)?.name || image.area}
                  </Tag>
                </div>
              </div>
            </div>
          );
        })()}
      </Flicking>

      <div className="overlay">
        <CSSTransition in={!!message} timeout={1000} classNames="fade" unmountOnExit>
          <div>{message}</div>
        </CSSTransition>
      </div>
    </>
  }

  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={DarkTheme}>
        <SwitchTransition>
          <CSSTransition
            key={stage}
            timeout={300}
            classNames="page"
            unmountOnExit>
            {render()}
          </CSSTransition>
        </SwitchTransition>
      </BaseProvider>
    </StyletronProvider>
  );
}

export default App;
