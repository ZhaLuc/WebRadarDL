import { forwardRef } from "react";
import mapDefinition from "../data/deadlock/map-definition.json";
import "./statlockermap.css";

const MAP_BASE = "./data/deadlock/map";
const OBJECTIVE_LAYER_ORDER = [
  "laneGuardian",
  "laneWalker",
  "baseGuardian",
  "finalBoss",
  "baseShrine",
];

const assetUrl = (file) => `${MAP_BASE}/${file}`;

const groupObjectivesByType = (objectives) => {
  const groups = new Map();

  for (const objective of objectives) {
    if (!groups.has(objective.type)) {
      groups.set(objective.type, []);
    }
    groups.get(objective.type).push(objective);
  }

  return OBJECTIVE_LAYER_ORDER.filter((type) => groups.has(type)).map((type) => ({
    type,
    items: groups.get(type),
  }));
};

const StatLockerMap = forwardRef(function StatLockerMap(_props, ref) {
  const objectiveLayers = groupObjectivesByType(mapDefinition.objectives);

  return (
    <div className="statlocker-map w-full">
      <div className="dtm-map-container" ref={ref}>
        <div className="dtm-map-inner">
          <div className="dtm-base-map">
            {mapDefinition.layers.map((layer) => (
              <img
                key={layer.file}
                alt="Deadlock map layer"
                className={layer.className}
                src={assetUrl(layer.file)}
                draggable={false}
              />
            ))}
          </div>

          <svg
            className="dtm-lane-svg"
            viewBox={`0 0 ${mapDefinition.size} ${mapDefinition.size}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {mapDefinition.lanePaths.map((path) => (
              <path
                key={`${path.className}-${path.d.slice(0, 24)}`}
                d={path.d}
                className={path.className}
                stroke={path.stroke}
              />
            ))}
          </svg>

          <div className="dtm-objectives-mask">
            {objectiveLayers.map((layer) => (
              <div key={layer.type} className="dtm-objectives-layer">
                {layer.items.map((objective) => (
                  <div
                    key={`${objective.type}-${objective.team}-${objective.lane}-${objective.left}-${objective.top}`}
                    className={`dtm-objective-tag ${objective.type} team-${objective.team} lane-${objective.lane}`}
                    style={{ left: `${objective.left}px`, top: `${objective.top}px` }}
                  >
                    <div className="dtm-objective-image-container">
                      <img
                        alt={`${objective.type} objective`}
                        className="dtm-objective-image"
                        src={assetUrl(objective.fill)}
                        draggable={false}
                      />
                      <img
                        alt={`${objective.type} objective health`}
                        className="dtm-objective-image health"
                        src={assetUrl(objective.health)}
                        draggable={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="dtm-shops-mask">
            {mapDefinition.shops.map((shop) => (
              <div
                key={`shop-${shop.team}-${shop.lane}-${shop.left}-${shop.top}`}
                className={`dtm-misc-marker-tag ${shop.team} lane-${shop.lane}`}
                style={{ left: `${shop.left}px`, top: `${shop.top}px` }}
              >
                <img
                  alt="shop"
                  className="dtm-misc-marker-image shop"
                  src={assetUrl(shop.icon)}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default StatLockerMap;
