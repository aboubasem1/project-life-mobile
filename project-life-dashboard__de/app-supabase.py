import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import os
from supabase import create_client, Client

# ===== Supabase Config =====
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

@st.cache_resource
def init_supabase() -> Client:
    """Initialize Supabase client"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.error("⚠️ Supabase nicht konfiguriert!")
        st.info("Bitte setze SUPABASE_URL und SUPABASE_KEY in deiner .env Datei oder als Umgebungsvariablen.")
        st.stop()
    return create_client(SUPABASE_URL, SUPABASE_KEY)

supabase = init_supabase()

# ===== Datenbank Funktionen =====
def fetch_all_entries():
    """Hole alle Einträge aus Supabase"""
    try:
        response = supabase.table("daily_entries").select("*").order("datum", desc=True).execute()
        if response.data:
            df = pd.DataFrame(response.data)
            df['datum'] = pd.to_datetime(df['datum'])
            return df
        return pd.DataFrame()
    except Exception as e:
        st.error(f"Fehler beim Laden: {e}")
        return pd.DataFrame()

def fetch_entry(date):
    """Hole einen einzelnen Eintrag"""
    try:
        response = supabase.table("daily_entries").select("*").eq("datum", date).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        st.error(f"Fehler: {e}")
        return None

def upsert_entry(date, updates):
    """Erstelle oder aktualisiere einen Eintrag"""
    try:
        payload = {"datum": date, **updates}
        response = supabase.table("daily_entries").upsert(payload, on_conflict="datum").execute()
        return True
    except Exception as e:
        st.error(f"Fehler beim Speichern: {e}")
        return False

# ===== UI Setup =====
st.set_page_config(page_title="Project Life Dashboard", page_icon="📊", layout="wide")

st.title("📊 Project Life Dashboard")
st.caption("🔄 Automatische Sync mit Supabase")

# ===== Tabs =====
tab_eingabe, tab_analyse, tab_daten = st.tabs(["📝 Eingabe", "📈 Analyse", "💾 Daten"])

# ===== Tab: Eingabe =====
with tab_eingabe:
    datum = st.date_input("📅 Datum", value=datetime.today())
    datum_str = datum.strftime("%Y-%m-%d")
    
    # Lade existierenden Eintrag
    existing = fetch_entry(datum_str) or {}
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("🌅 Morgen")
        am_training = st.checkbox("Training gemacht", value=existing.get("training", False), key="am_training")
        
        c1, c2 = st.columns(2)
        with c1:
            meditation = st.number_input("Meditation (Min)", min_value=0, value=existing.get("meditation_min") or 0, step=5)
        with c2:
            cold_shower = st.checkbox("Cold Shower", value=existing.get("cold_shower", False))
        
        protein_shake = st.checkbox("Protein Shake", value=existing.get("protein_shake", False))
        
        c1, c2 = st.columns(2)
        with c1:
            deep_work_1 = st.number_input("Deep Work Session 1 (Min)", min_value=0, value=existing.get("deep_work_1_min") or 0, step=15)
        with c2:
            deep_work_2 = st.number_input("Deep Work Session 2 (Min)", min_value=0, value=existing.get("deep_work_2_min") or 0, step=15)
        
        if st.button("💾 Morgen speichern", use_container_width=True):
            updates = {
                "training": am_training,
                "meditation_min": meditation if meditation > 0 else None,
                "cold_shower": cold_shower,
                "protein_shake": protein_shake,
                "deep_work_1_min": deep_work_1 if deep_work_1 > 0 else None,
                "deep_work_2_min": deep_work_2 if deep_work_2 > 0 else None
            }
            if upsert_entry(datum_str, updates):
                st.success("✅ Morgen-Daten gespeichert!")
                st.rerun()
    
    with col2:
        st.subheader("🌙 Abend")
        pm_training = st.checkbox("Training gemacht", value=existing.get("training", False), key="pm_training")
        
        c1, c2 = st.columns(2)
        with c1:
            schritte = st.number_input("Schritte", min_value=0, value=existing.get("schritte") or 0, step=100)
        with c2:
            protein = st.number_input("Protein (g)", min_value=0, value=existing.get("protein_gramm") or 0, step=10)
        
        c1, c2 = st.columns(2)
        with c1:
            bildschirm = st.number_input("Bildschirmzeit (Min)", min_value=0, value=existing.get("bildschirmzeit_min") or 0, step=15)
        with c2:
            wasser = st.number_input("Wasser (L)", min_value=0.0, value=float(existing.get("wasser_liter") or 0), step=0.5)
        
        c1, c2 = st.columns(2)
        with c1:
            journal = st.checkbox("Journal geschrieben", value=existing.get("journal", False))
        with c2:
            reading = st.number_input("Gelesen (Min)", min_value=0, value=existing.get("reading_min") or 0, step=10)
        
        if st.button("💾 Abend speichern", use_container_width=True):
            updates = {
                "training": pm_training,
                "schritte": schritte if schritte > 0 else None,
                "protein_gramm": protein if protein > 0 else None,
                "bildschirmzeit_min": bildschirm if bildschirm > 0 else None,
                "wasser_liter": wasser if wasser > 0 else None,
                "journal": journal,
                "reading_min": reading if reading > 0 else None
            }
            if upsert_entry(datum_str, updates):
                st.success("✅ Abend-Daten gespeichert!")
                st.rerun()

# ===== Tab: Analyse =====
with tab_analyse:
    df = fetch_all_entries()
    
    if df.empty:
        st.info("📭 Noch keine Daten vorhanden.")
    else:
        st.subheader("📊 Letzte 7 Tage")
        
        last_7_days = df.head(7).copy()
        
        # Metriken
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            training_count = last_7_days['training'].sum() if 'training' in last_7_days else 0
            st.metric("🏋️ Training", f"{training_count}/7 Tage")
        with col2:
            journal_count = last_7_days['journal'].sum() if 'journal' in last_7_days else 0
            st.metric("📓 Journal", f"{journal_count}/7 Tage")
        with col3:
            avg_water = last_7_days['wasser_liter'].mean() if 'wasser_liter' in last_7_days else 0
            st.metric("💧 Ø Wasser", f"{avg_water:.1f}L")
        with col4:
            avg_protein = last_7_days['protein_gramm'].mean() if 'protein_gramm' in last_7_days else 0
            st.metric("🥩 Ø Protein", f"{avg_protein:.0f}g")
        
        # Charts
        st.subheader("📈 Trends")
        
        if 'deep_work_1_min' in last_7_days and 'deep_work_2_min' in last_7_days:
            last_7_days['total_deep_work'] = (
                last_7_days['deep_work_1_min'].fillna(0) + 
                last_7_days['deep_work_2_min'].fillna(0)
            )
            st.line_chart(last_7_days.set_index('datum')['total_deep_work'])
        
        if 'wasser_liter' in last_7_days:
            st.bar_chart(last_7_days.set_index('datum')['wasser_liter'])

# ===== Tab: Daten =====
with tab_daten:
    st.subheader("💾 Alle Einträge")
    
    df = fetch_all_entries()
    
    if df.empty:
        st.info("📭 Noch keine Daten vorhanden.")
    else:
        st.dataframe(df, use_container_width=True, height=400)
        
        # CSV Export
        csv = df.to_csv(index=False)
        st.download_button(
            label="📥 CSV herunterladen",
            data=csv,
            file_name=f"project_life_export_{datetime.now().strftime('%Y%m%d')}.csv",
            mime="text/csv"
        )
