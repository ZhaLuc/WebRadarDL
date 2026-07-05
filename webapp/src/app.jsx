import { useEffect, useRef, useState } from "react";

import "./App.css";

import { useInterpolatedPlayers } from "./hooks/useInterpolatedPlayers";

import PlayerCard from "./components/PlayerCard";

import Radar from "./components/Radar";

import StatLockerMap from "./components/StatLockerMap";

import SettingsButton from "./components/settings";

import {

  loadCalibration,

  teamEnum,

  isRadarHost,

  getWebSocketUrl,

  SESSION_SHARE_TYPE,

} from "./utilities/utilities";



const DEFAULT_SETTINGS = { dotSize: 1 };



const loadSettings = () => {

  const saved = localStorage.getItem("deadlockRadarSettings");

  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;

};



const App = () => {

  const isHost = isRadarHost();

  const [playerArray, setPlayerArray] = useState([]);

  const [mapData, setMapData] = useState();

  const [bounds, setBounds] = useState();

  const [localTeam, setLocalTeam] = useState();

  const [heroMap, setHeroMap] = useState();

  const [settings, setSettings] = useState(loadSettings);

  const [calibration, setCalibration] = useState(loadCalibration);

  const [connectionStatus, setConnectionStatus] = useState("connecting");

  const [calibrationMode, setCalibrationMode] = useState(false);

  const [debugData, setDebugData] = useState(null);

  const [shareInfo, setShareInfo] = useState(null);

  const webSocketRef = useRef(null);



  useEffect(() => {

    if (!isHost) {

      return;

    }



    localStorage.setItem("deadlockRadarSettings", JSON.stringify(settings));

  }, [settings, isHost]);



  useEffect(() => {

    if (!isHost) {

      return;

    }



    localStorage.setItem("deadlockMapCalibration", JSON.stringify(calibration));

  }, [calibration, isHost]);



  useEffect(() => {

    fetch("./heroes/hero_map.json")

      .then((res) => res.json())

      .then(setHeroMap)

      .catch(console.error);



    fetch("./data/deadlock/data.json")

      .then((res) => res.json())

      .then((data) => {

        setMapData({ ...data, name: "deadlock" });

        if (isHost) {

          setCalibration((prev) => ({ ...prev, ...data }));

        }

      })

      .catch(console.error);

  }, [isHost]);



  useEffect(() => {

    if (!isHost) {

      return;

    }



    const loadShareInfo = () => {

      fetch("/api/radar/share-info")

        .then((res) => (res.ok ? res.json() : null))

        .then((data) => data && setShareInfo(data))

        .catch(() => {});

    };



    loadShareInfo();

    const timer = setInterval(loadShareInfo, 2000);

    return () => clearInterval(timer);

  }, [isHost]);



  useEffect(() => {

    let webSocket = null;

    let reconnectTimer = null;

    let usermodeTimer = null;

    let disposed = false;

    let gotData = false;



    const connect = () => {

      setConnectionStatus("connecting");

      webSocket = new WebSocket(getWebSocketUrl());

      webSocketRef.current = webSocket;



      webSocket.onopen = () => {

        gotData = false;

        setConnectionStatus(isHost ? "connected" : "watching-waiting");

        clearTimeout(usermodeTimer);



        if (isHost) {

          webSocket.send(

            JSON.stringify({

              m_message_type: SESSION_SHARE_TYPE,

              m_calibration: calibration,

              m_settings: settings,

            })

          );

        }



        usermodeTimer = setTimeout(() => {

          if (!gotData && !disposed) {

            setConnectionStatus(isHost ? "waiting-usermode" : "watching-waiting");

          }

        }, 4000);

      };



      webSocket.onclose = () => {

        webSocketRef.current = null;

        setConnectionStatus("disconnected");

        if (!disposed) {

          reconnectTimer = setTimeout(connect, 3000);

        }

      };



      webSocket.onerror = () => {

        setConnectionStatus("error");

      };



      webSocket.onmessage = async (event) => {

        try {

          const raw =

            typeof event.data === "string"

              ? event.data

              : await event.data.text();

          const parsedData = JSON.parse(raw);



          if (parsedData.m_message_type === SESSION_SHARE_TYPE) {

            if (parsedData.m_calibration) {

              setCalibration((prev) => ({ ...prev, ...parsedData.m_calibration }));

            }

            if (parsedData.m_settings) {

              setSettings((prev) => ({ ...prev, ...parsedData.m_settings }));

            }

            return;

          }



          setPlayerArray(parsedData.m_players || []);

          setLocalTeam(parsedData.m_local_team);

          setBounds({

            mins: parsedData.m_minimap_mins,

            maxs: parsedData.m_minimap_maxs,

          });

          setDebugData(parsedData.m_debug || null);

          gotData = true;

          clearTimeout(usermodeTimer);



          if (parsedData.m_debug?.reader_state === "waiting_game") {

            setConnectionStatus(isHost ? "waiting-game" : "watching-waiting");

            return;

          }



          if (parsedData.m_source === "live") {

            setConnectionStatus(isHost ? "receiving-live" : "watching-live");

          } else {

            setConnectionStatus(isHost ? "receiving" : "watching");

          }

        } catch (err) {

          console.error("WebSocket message parse error:", err);

        }

      };

    };



    connect();



    return () => {

      disposed = true;

      clearTimeout(reconnectTimer);

      clearTimeout(usermodeTimer);

      webSocket?.close();

      webSocketRef.current = null;

    };

  }, [isHost]);



  useEffect(() => {

    if (!isHost) {

      return;

    }



    const webSocket = webSocketRef.current;

    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {

      return;

    }



    const timer = setTimeout(() => {

      webSocket.send(

        JSON.stringify({

          m_message_type: SESSION_SHARE_TYPE,

          m_calibration: calibration,

          m_settings: settings,

        })

      );

    }, 250);



    return () => clearTimeout(timer);

  }, [calibration, settings, isHost, connectionStatus]);



  const radarPlayers = useInterpolatedPlayers(playerArray, {
    enabled: !calibrationMode,
  });

  const teammates = playerArray.filter(

    (player) => player.m_team === localTeam && player.m_team !== 1

  );

  const enemies = playerArray.filter(

    (player) => player.m_team !== localTeam && player.m_team !== 1

  );



  const localPlayer =

    playerArray.find((p) => p.m_is_local) ||

    playerArray.find((p) => p.m_team === localTeam);

  const hasRadarData =

    (playerArray.length > 0 || debugData?.entity_system_ok) &&

    mapData &&

    bounds?.mins;

  const teamLabel =

    localTeam === teamEnum.amber

      ? "Amber"

      : localTeam === teamEnum.sapphire

        ? "Sapphire"

        : null;

  const statusMessage = {

    connecting: "Connecting to WebSocket relay...",

    connected: "Relay connected - waiting for radar_reader.exe (run as admin)",

    "waiting-usermode": "Relay connected - radar_reader.exe not running (approve UAC / restart WebRadarDL)",

    "waiting-game": "radar_reader connected - launch Deadlock and join a match",

    "receiving-live": `Live${teamLabel ? ` · ${teamLabel}` : ""} - ${playerArray.length} players`,

    receiving: `Receiving data - ${playerArray.length} players (not from reader)`,

    "watching-live": `Watching${teamLabel ? ` · ${teamLabel}` : ""} - ${playerArray.length} players`,

    watching: `Watching shared radar - ${playerArray.length} players`,

    "watching-waiting": "Watching - waiting for host match data...",

    disconnected: "Relay disconnected - retrying in 3s...",

    error: "WebSocket error - run WebRadarDL on the host PC",

  }[connectionStatus];



  return (

    <div className="w-screen h-screen flex flex-col bg-black">

      <div className="w-full h-full flex flex-col justify-center overflow-hidden relative bg-black">

        <div className="absolute left-2.5 top-2.5 z-50 text-xs text-radar-secondary bg-radar-panel/80 px-2 py-1 rounded">

          {statusMessage}

          {!isHost && (

            <span className="ml-2 text-radar-primary/80">(viewer)</span>

          )}

        </div>



        <div className="absolute right-2.5 top-2.5 z-50">

          <SettingsButton

            settings={settings}

            onSettingsChange={setSettings}

            calibration={calibration}

            onCalibrationChange={setCalibration}

            bounds={bounds}

            localPlayer={localPlayer}

            connectionStatus={connectionStatus}

            calibrationMode={calibrationMode}

            onCalibrationModeChange={setCalibrationMode}

            debugData={debugData}

            playerCount={playerArray.length}

            heroMap={heroMap}

            isHost={isHost}

            shareInfo={shareInfo}

          />

        </div>



        <div className="flex items-center justify-center px-4 flex-1 overflow-auto py-4">

          <ul className="lg:flex hidden flex-col gap-2 m-0 p-0 min-w-[9rem] max-h-full overflow-y-auto">

            {teammates.map((player) => (

              <PlayerCard

                key={player.m_idx}

                playerData={player}

                isOnRightSide={false}

                heroMap={heroMap}

              />

            ))}

          </ul>



          {hasRadarData ? (

            <Radar

              playerArray={radarPlayers}

              bounds={bounds}

              mapData={calibration}

              localTeam={localTeam}

              settings={settings}

              heroMap={heroMap}

              calibrationMode={isHost && calibrationMode}

            />

          ) : (

            <div

              id="radar"

              className="relative overflow-hidden origin-center max-w-[900px] w-full opacity-60"

            >

              <StatLockerMap />

              <h1 className="radar_message absolute inset-0 flex items-center justify-center text-center px-4">

                {statusMessage}

              </h1>

            </div>

          )}



          <ul className="lg:flex hidden flex-col gap-2 m-0 p-0 min-w-[9rem] max-h-full overflow-y-auto">

            {enemies.map((player) => (

              <PlayerCard

                key={player.m_idx}

                playerData={player}

                isOnRightSide={true}

                heroMap={heroMap}

              />

            ))}

          </ul>

        </div>

      </div>

    </div>

  );

};



export default App;


