import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib
import os

# Look for the .log file now
LOG_FILE = os.path.join("..", "server_traffic.log")
MODEL_FILE = "network_model.pkl"

def train():
    print("Loading data...")
    COLUMNS = ['timestamp', 'ip', 'endpoint', 'method', 'status_code', 'content_length']
    
    try:
        # Read LOG file with manual column names
        df = pd.read_csv(LOG_FILE, names=COLUMNS)
    except FileNotFoundError:
        print("Error: server_traffic.log not found. Run the app first.")
        return

    # === Data Cleaning ===
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s', errors='coerce')
    df = df.dropna(subset=['timestamp'])
    
    # Filter last 24h
    now = pd.Timestamp.now()
    df = df[df['timestamp'] > (now - pd.Timedelta(hours=24))]
    
    df.set_index('timestamp', inplace=True)

    # === Feature Engineering ===
    print("Aggregating traffic features...")
    features = df.groupby('ip').resample('1s').agg({
        'endpoint': 'count',           
        'status_code': lambda x: (x >= 400).mean(), 
        'content_length': 'sum'        
    }).dropna()
    features.columns = ['request_rate', 'error_rate', 'byte_count']

    # === Train ===
    print(f"Training on {len(features)} data points...")
    clf = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    clf.fit(features)
    joblib.dump(clf, MODEL_FILE)
    print("Success! Model saved.")

if __name__ == "__main__":
    train()