import { useEffect, useRef, useState } from "react";

import "./App.css";

import { useInterpolatedPlayers } from "./hooks/useInterpolatedPlayers";

import PlayerCard from "./components/PlayerCard";

import Radar from "./components/Radar";

import StatLockerMap from "./components/StatLockerMap";

import SettingsButton from "./components/settings";

import {
  enemyIsNearSubject,
  loadPingFollow,
  loadPingSettings,
  pingSubjectKey,
  playEnemyProximityPing,
  resolvePingSubject,
  savePingFollow,
  savePingSettings,
  unlockProximityAudio,
} from "./utilities/proximityPing";

import {
  loadCalibration,
  teamEnum,
  isRadarHost,
  getPlayerName,
  getWebSocketUrl,
  SESSION_SHARE_TYPE,
  READER_CONTROL_TYPE,
  VIEWER_HELLO_TYPE,
  HOST_HELLO_TYPE,
  DEFAULT_SETTINGS,
  buildPerformanceControlMessage,
  buildReloadMapMessage,
} from "./utilities/utilities";



const loadSettings = () => {

  const saved = localStorage.getItem("deadlockRadarSettings");

  return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };

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

  const [mapReloadToken, setMapReloadToken] = useState(0);

  const [friendLinkCopied, setFriendLinkCopied] = useState(false);

  const [pingSettings, setPingSettings] = useState(loadPingSettings);
  const [pingFollowKey, setPingFollowKey] = useState(loadPingFollow);
  const pingContactRef = useRef(false);
  const lastPingAtRef = useRef(0);

  const webSocketRef = useRef(null);

  const sendReaderControl = (payload) => {
    const webSocket = webSocketRef.current;
    if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    webSocket.send(JSON.stringify(payload));
    return true;
  };

  const updatePingSettings = (patch) => {
    unlockProximityAudio();
    setPingSettings((current) => {
      const next = { ...current, ...patch };
      savePingSettings(next);
      return next;
    });
  };

  const selectPingSubject = (player) => {
    const key = pingSubjectKey(player);
    setPingFollowKey(key);
    savePingFollow(key);
    pingContactRef.current = false;
  };

  useEffect(() => {
    if (!pingSettings.enabled) {
      pingContactRef.current = false;
      return;
    }

    const subject = resolvePingSubject(playerArray, pingFollowKey, isHost);
    const inRange = enemyIsNearSubject(playerArray, subject, pingSettings.range);
    if (!inRange) {
      pingContactRef.current = false;
      return;
    }

    const now = performance.now();
    const firstContact = !pingContactRef.current;
    const intervalMs = Math.max(1, pingSettings.intervalSec) * 1000;
    if (firstContact || now - lastPingAtRef.current >= intervalMs) {
      playEnemyProximityPing(pingSettings.sound, pingSettings.volume, firstContact);
      lastPingAtRef.current = now;
      pingContactRef.current = true;
    }
  }, [playerArray, pingSettings, pingFollowKey, isHost]);

  const reloadMap = () => {
    setPlayerArray([]);
    setBounds(undefined);
    setDebugData(null);
    setMapReloadToken((token) => token + 1);
    sendReaderControl(buildReloadMapMessage());
  };



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

              m_message_type: HOST_HELLO_TYPE,

            })

          );

          webSocket.send(

            JSON.stringify({

              m_message_type: SESSION_SHARE_TYPE,

              m_calibration: calibration,

              m_settings: settings,

            })

          );

          webSocket.send(JSON.stringify(buildPerformanceControlMessage(settings)));

        } else {

          webSocket.send(

            JSON.stringify({

              m_message_type: VIEWER_HELLO_TYPE,

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

          if (parsedData.m_message_type === READER_CONTROL_TYPE) {
            if (parsedData.m_command === "reload_map") {
              setPlayerArray([]);
              setBounds(undefined);
              setMapReloadToken((token) => token + 1);
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

      webSocket.send(JSON.stringify(buildPerformanceControlMessage(settings)));

    }, 250);



    return () => clearTimeout(timer);

  }, [calibration, settings, isHost, connectionStatus]);



  const radarPlayers = useInterpolatedPlayers(playerArray, {
    enabled: !calibrationMode,
    resetToken: mapReloadToken,
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

  const playersOffMap =
    isHost &&
    playerArray.length > 0 &&
    playerArray.every((player) => {
      const x = player.m_position?.x ?? 0;
      const y = player.m_position?.y ?? 0;
      return !player.m_has_pawn || (x === 0 && y === 0);
    });

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

  const friendLink =
    shareInfo?.publicUrl ||
    shareInfo?.viewerUrls?.[0] ||
    shareInfo?.localUrl ||
    null;

  const copyFriendLink = async () => {
    if (!friendLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(friendLink);
      setFriendLinkCopied(true);
      setTimeout(() => setFriendLinkCopied(false), 2000);
    } catch {
      // clipboard may be blocked
    }
  };



  return (

    <div className="w-screen h-screen flex flex-col bg-black">

      <div className="w-full h-full flex flex-col justify-center overflow-hidden relative bg-black">

        <div className="absolute left-2.5 top-2.5 z-50 flex flex-col gap-1.5 max-w-[min(26rem,72vw)]">

          <div className="text-xs text-radar-secondary bg-radar-panel/80 px-2 py-1 rounded">

            {statusMessage}

            {!isHost && (

              <span className="ml-2 text-radar-primary/80">(viewer)</span>

            )}

          </div>

          {isHost && (

            <div className="text-xs bg-radar-panel/80 border border-radar-secondary/20 px-2.5 py-2 rounded space-y-1.5">

              <div className="text-radar-secondary">

                Viewers connected:{" "}

                <span className="text-radar-primary font-semibold">

                  {shareInfo?.viewerCount ?? 0}

                </span>

              </div>

              <button

                type="button"

                onClick={copyFriendLink}

                disabled={!friendLink}

                className="w-full text-left rounded bg-black/30 border border-radar-secondary/25 px-2 py-1.5 hover:border-radar-primary/50 transition-colors disabled:opacity-50 disabled:cursor-default"

                title="Click to copy friend link"

              >

                <div className="text-[9px] uppercase tracking-wide text-radar-secondary mb-0.5">

                  Friend link (works anywhere)

                </div>

                <div className="text-radar-primary font-mono text-[10px] truncate">

                  {friendLinkCopied

                    ? "Copied!"

                    : friendLink ||

                      (shareInfo?.tunnelStatus === "starting"

                        ? "Public link starting..."

                        : "Waiting for share link...")}

                </div>

              </button>

            </div>

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

            onReloadMap={reloadMap}

            pingSettings={pingSettings}

            onPingSettingsChange={updatePingSettings}

            pingSubjectName={(() => {
              const subject = resolvePingSubject(playerArray, pingFollowKey, isHost);
              return subject ? getPlayerName(subject, heroMap) : "";
            })()}

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

                isPingSubject={
                  pingSubjectKey(player) ===
                  pingSubjectKey(resolvePingSubject(playerArray, pingFollowKey, isHost))
                }

                onSelectForPing={() => selectPingSubject(player)}

              />

            ))}

          </ul>



          {playersOffMap && (
            <button
              type="button"
              onClick={reloadMap}
              className="absolute left-1/2 top-16 z-50 -translate-x-1/2 max-w-[min(28rem,90vw)] rounded-lg border border-amber-400/60 bg-black/85 px-4 py-2.5 text-left shadow-lg hover:border-amber-300"
            >
              <div className="text-amber-300 text-xs font-semibold">
                Place players on map
              </div>
              <div className="text-[11px] text-radar-secondary mt-0.5 leading-snug">
                Heroes are listed, but nobody is on the map yet. Click once after loading into the match.
              </div>
            </button>
          )}

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

                isPingSubject={
                  pingSubjectKey(player) ===
                  pingSubjectKey(resolvePingSubject(playerArray, pingFollowKey, isHost))
                }

                onSelectForPing={() => selectPingSubject(player)}

              />

            ))}

          </ul>

        </div>

      </div>

    </div>

  );

};



export default App;


