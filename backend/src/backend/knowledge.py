"""Local verified PNN Los Nevados knowledge loader and altitude radar calculator."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from backend.schemas import Especie, KnowledgeBase, PisoTermico, RadarResponse

KNOWLEDGE_PATH = Path(__file__).resolve().parent / "data" / "pnnn_knowledge.json"


@lru_cache(maxsize=1)
def load_knowledge() -> KnowledgeBase:
    """Load and validate the verified PNNN scientific knowledge base from disk."""
    raw = KNOWLEDGE_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)
    return KnowledgeBase.model_validate(data)


def _select_thermal_belt(altitud_m: int, belts: list[PisoTermico]) -> PisoTermico:
    """Return the thermal belt matching the elevation, handling edges gracefully."""
    if altitud_m < belts[0].min_m:
        return PisoTermico(
            piso="Zona Subandina de Aproximación",
            min_m=1500,
            max_m=2299,
            temp="15°C - 20°C",
            descripcion=(
                "Franja de transición cafetera y andina previa al ingreso "
                "al Bosque Altoandino del Parque Nacional Natural Los Nevados."
            ),
            especies_clave=["Palma de Cera del Quindío", "Oso de Anteojos"],
        )

    for belt in belts:
        if belt.min_m <= altitud_m <= belt.max_m:
            return belt

    return PisoTermico(
        piso="Zona Nival / Glaciar (Acceso Restringido)",
        min_m=4801,
        max_m=5321,
        temp="-4°C - 0°C",
        descripcion=(
            "Casquete glaciar y nieves perpetuas. El acceso turístico está "
            "restringido por actividad volcánica y riesgo extremo de hipotermia."
        ),
        especies_clave=["Cóndor de los Andes", "Cacho de Venado"],
    )


def _match_species_for_belt(
    belt: PisoTermico,
    all_species: list[Especie],
) -> list[Especie]:
    """Match verified species cards belonging to the active thermal belt."""
    matched = [sp for sp in all_species if belt.piso in sp.pisos]
    if matched:
        return matched

    belt_terms = [term.lower() for term in belt.especies_clave]
    fallback = [
        sp
        for sp in all_species
        if any(
            term in sp.nombre_comun.lower() or sp.nombre_comun.lower() in term
            for term in belt_terms
        )
    ]
    return fallback if fallback else all_species[:3]


def _soroche_risk(
    altitud_m: int,
) -> tuple[Literal["Bajo", "Moderado", "Alto", "Muy Alto"], str]:
    """Determine acute mountain sickness risk level and actionable safety advice."""
    if altitud_m < 3000:
        return (
            "Bajo",
            "Altitud confortable para aclimatación. Hidrátate regularmente antes de ascender.",
        )
    if altitud_m <= 3500:
        return (
            "Moderado",
            "Inicio de disminución de oxígeno. Camina a ritmo constante y evita esfuerzos bruscos.",
        )
    if altitud_m <= 4100:
        return (
            "Alto",
            "Presión de oxígeno reducida (~35-40%). Toma agua en sorbos cortos y vigila dolor de cabeza o mareo.",
        )
    return (
        "Muy Alto",
        "Alta exigencia hipóxica y frío extremo. Si presentas dolor de cabeza pulsátil o náuseas, detén el ascenso y desciende 500 m.",
    )


def calculate_radar(altitud_m: int) -> RadarResponse:
    """Compute thermal floor, probable species, and safety advice for an elevation."""
    kb = load_knowledge()
    belt = _select_thermal_belt(altitud_m, kb.pisos_termicos)
    species = _match_species_for_belt(belt, kb.especies)
    risk, advice = _soroche_risk(altitud_m)

    return RadarResponse(
        altitud_m=altitud_m,
        piso_termico=belt,
        especies_probables=species,
        riesgo_soroche=risk,
        recomendacion_seguridad=advice,
    )
