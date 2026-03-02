pipeline {
    agent any

    environment {
        DEPLOY_DIR = '/home/ubuntu/DevForge'
    }

    stages {
        stage('Pull Latest') {
            steps {
                dir("${DEPLOY_DIR}") {
                    sh 'git pull origin master'
                }
            }
        }

        stage('Build & Deploy') {
            steps {
                dir("${DEPLOY_DIR}") {
                    sh 'docker compose down --remove-orphans || true'
                    sh 'docker compose build --no-cache'
                    sh 'docker compose up -d'
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    sleep(10)
                    def frontendStatus = sh(
                        script: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:5173',
                        returnStdout: true
                    ).trim()
                    def wsStatus = sh(
                        script: 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3001',
                        returnStdout: true
                    ).trim()
                    echo "Frontend: ${frontendStatus}, WS Server: ${wsStatus}"
                    if (frontendStatus != '200') {
                        error("Frontend health check failed: ${frontendStatus}")
                    }
                }
            }
        }

        stage('Cleanup') {
            steps {
                sh 'docker image prune -f || true'
            }
        }
    }

    post {
        failure {
            echo 'Deployment failed! Check logs.'
        }
        success {
            echo 'Deployment successful!'
        }
    }
}
