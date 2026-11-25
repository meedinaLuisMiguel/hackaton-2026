"""Unit tests for PNN Los Nevados scientific knowledge and altitude radar."""

import pytest

from backend.knowledge import calculate_radar, load_knowledge


def test_knowledge_base_has_required_content() -> None:
    kb = load_knowledge()
    assert len(kb.rutas) == 3
    assert len(kb.pisos_termicos) == 4
    assert len(kb.especies) == 12
    assert "soroche" in kb.protocolos_vida
    assert "hipotermia" in kb.protocolos_vida
    assert "volcanico" in kb.protocolos_vida
    assert len(kb.directorio_emergencias) == 3


@pytest.mark.parametrize(
    ("altitud", "expected_piso", "expected_risk"),
    [
        (2000, "Zona Subandina de Aproximación", "Bajo"),
        (2300, "Bosque Altoandino", "Bajo"),
        (3200, "Bosque Altoandino", "Moderado"),
        (3350, "Subpáramo", "Moderado"),
        (3800, "Páramo Propiamente Dicho", "Alto"),
        (4150, "Superpáramo", "Muy Alto"),
        (5000, "Zona Nival / Glaciar (Acceso Restringido)", "Muy Alto"),
    ],
)
def test_calculate_radar_elevation_bands(
    altitud: int,
    expected_piso: str,
    expected_risk: str,
) -> None:
    radar = calculate_radar(altitud)
    assert radar.altitud_m == altitud
    assert radar.piso_termico.piso == expected_piso
    assert radar.riesgo_soroche == expected_risk
    assert len(radar.especies_probables) >= 1
    assert len(radar.recomendacion_seguridad) > 10
