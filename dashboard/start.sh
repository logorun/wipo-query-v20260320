#!/bin/bash
echo "🌐 Starting WIPO Trademark Dashboard..."
if ! curl -s http://localhost:3000/api/v1/health > /dev/null; then
    echo "⚠️  Warning: API server not running on port 3000"
fi
python3 -m http.server 8080 &
DASHBOARD_PID=$!
echo "✅ Dashboard started at http://localhost:8080"
echo "   PID: $DASHBOARD_PID"
trap "kill $DASHBOARD_PID; exit" INT
wait
