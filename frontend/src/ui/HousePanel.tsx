import { useHouseStore } from "../store/useHouseStore";
import { sendFurniturePlace, sendFurnitureRemove } from "../net/outgoing";

const FURNITURE_OPTIONS = [
  { slug: "furn_bed",   label: "🛏️", name: "Cama" },
  { slug: "furn_table", label: "🪵", name: "Mesa" },
  { slug: "furn_chair", label: "🪑", name: "Cadeira" },
  { slug: "furn_rug",   label: "🟫", name: "Tapete" },
  { slug: "furn_plant", label: "🌿", name: "Planta" },
  { slug: "furn_lamp",  label: "💡", name: "Lâmpada" },
];

export function HousePanel() {
  const inHouse = useHouseStore((s) => s.inHouse);
  const nearHouse = useHouseStore((s) => s.nearHouse);
  const selectedCell = useHouseStore((s) => s.selectedCell);
  const selectedFurnitureId = useHouseStore((s) => s.selectedFurnitureId);
  const setInHouse = useHouseStore((s) => s.setInHouse);
  const setSelectedCell = useHouseStore((s) => s.setSelectedCell);
  const setSelectedFurnitureId = useHouseStore((s) => s.setSelectedFurnitureId);

  const handlePlace = (slug: string) => {
    if (!selectedCell) return;
    sendFurniturePlace(slug, selectedCell.x, selectedCell.y, 0);
    setSelectedCell(null);
  };

  const handleRemove = () => {
    if (!selectedFurnitureId) return;
    sendFurnitureRemove(selectedFurnitureId);
    setSelectedFurnitureId(null);
  };

  // Not in house: show "Enter" button only when near the house door.
  if (!inHouse) {
    if (!nearHouse) return null;
    return (
      <button
        onClick={() => setInHouse(true)}
        className="absolute bottom-28 right-6 rounded-2xl bg-cozy-accent px-5 py-3 text-cozy-bg text-sm font-semibold shadow-lg active:scale-95"
      >
        Entrar 🏠
      </button>
    );
  }

  return (
    <>
      {/* Exit button — always visible when inside */}
      <button
        onClick={() => setInHouse(false)}
        className="absolute top-4 right-4 rounded-xl bg-black/40 px-3 py-2 text-cozy-soft text-sm shadow-md active:scale-95"
      >
        Sair 🚪
      </button>

      {/* Furniture palette — shown after selecting an empty cell */}
      {selectedCell && (
        <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-cozy-panel/98 p-5 shadow-2xl backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-cozy-accent">
              Célula {selectedCell.x}, {selectedCell.y}
            </span>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-xl opacity-50 active:scale-95"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {FURNITURE_OPTIONS.map(({ slug, label, name }) => (
              <button
                key={slug}
                onClick={() => handlePlace(slug)}
                className="flex flex-col items-center gap-1 rounded-2xl bg-black/20 py-3 text-2xl active:scale-95"
              >
                {label}
                <span className="text-xs text-cozy-soft/70">{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Remove panel — shown after tapping an occupied cell */}
      {selectedFurnitureId && (
        <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-cozy-panel/98 p-5 shadow-2xl backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-cozy-accent">Móvel selecionado</span>
            <button
              onClick={() => setSelectedFurnitureId(null)}
              className="text-xl opacity-50 active:scale-95"
            >
              ×
            </button>
          </div>
          <button
            onClick={handleRemove}
            className="w-full rounded-2xl bg-red-900/50 py-4 text-red-200 text-sm font-semibold active:scale-[0.98]"
          >
            Remover móvel 🗑️
          </button>
        </div>
      )}
    </>
  );
}
