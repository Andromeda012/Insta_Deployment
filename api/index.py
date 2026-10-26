import time
from datetime import datetime
from flask import Flask, jsonify, request

app = Flask(__name__)

# Mock deployment state
deployments = [
    {
        "id": "dep-001",
        "title": "Release v1.0.0 - Production Launch",
        "branch": "main",
        "author": "Andromeda012",
        "status": "success",
        "timestamp": "2026-10-25 20:00:00",
    },
    {
        "id": "dep-002",
        "title": "Vercel Serverless Architecture Migration",
        "branch": "main",
        "author": "Andromeda012",
        "status": "success",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
]

@app.route('/api', methods=['GET'])
@app.route('/api/', methods=['GET'])
def root():
    return jsonify({
        "service": "Insta Deployment API",
        "status": "online",
        "runtime": "Vercel Serverless Python",
        "version": "1.0.0",
        "endpoints": [
            "/api/health",
            "/api/metrics",
            "/api/deployments",
            "/api/deploy",
            "/api/instagram/status"
        ]
    })

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "uptime": "99.99%",
        "timestamp": datetime.now().isoformat(),
        "platform": "Vercel Serverless"
    })

@app.route('/api/metrics', methods=['GET'])
def metrics():
    return jsonify({
        "status": "Active",
        "activeVersion": "v1.0.0",
        "totalDeployments": len(deployments),
        "avgResponseTimeMs": 28,
        "successRate": "100%",
        "uptime": "99.99%"
    })

@app.route('/api/deployments', methods=['GET'])
def get_deployments():
    return jsonify({
        "deployments": deployments,
        "count": len(deployments)
    })

@app.route('/api/deploy', methods=['POST'])
def trigger_deploy():
    data = request.get_json(silent=True) or {}
    title = data.get("title", f"Manual Trigger #{len(deployments) + 1}")
    branch = data.get("branch", "main")

    new_dep = {
        "id": f"dep-{len(deployments) + 1:03d}",
        "title": title,
        "branch": branch,
        "author": "Andromeda012",
        "status": "success",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    deployments.insert(0, new_dep)

    return jsonify({
        "message": "Deployment triggered successfully",
        "deployment": new_dep
    }), 201

@app.route('/api/instagram/status', methods=['GET'])
def instagram_status():
    return jsonify({
        "connected": True,
        "account": "Insta_Deployment",
        "graph_api_version": "v19.0",
        "rate_limit_remaining": 98
    })

# Local testing runner
if __name__ == '__main__':
    app.run(port=5000, debug=True)
