pipeline {
    agent any

    environment {
        DEPLOY_DIR = '/home/ubuntu/DevForge'
    }

    triggers {
        pollSCM('H/2 * * * *')
    }

    stages {
        stage('Checkout') {
            steps {
                dir("${DEPLOY_DIR}") {
                    sh 'git fetch origin'
                    sh 'git reset --hard origin/master'
                    sh 'git clean -fd'
                }
            }
        }

        stage('Validate') {
            steps {
                dir("${DEPLOY_DIR}") {
                    sh 'docker compose config --quiet'
                }
            }
        }

        stage('Stop Previous') {
            steps {
                dir("${DEPLOY_DIR}") {
                    sh 'docker compose down --remove-orphans --timeout 30 || true'
                }
            }
        }

        stage('Build') {
            steps {
                dir("${DEPLOY_DIR}") {
                    sh 'docker compose build --parallel'
                }
            }
        }

        stage('Deploy') {
            steps {
                dir("${DEPLOY_DIR}") {
                    sh 'docker compose up -d'
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    // Wait for services to stabilize
                    sleep(15)

                    // Check nginx reverse proxy (port 80)
                    def nginxStatus = sh(
                        script: 'curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:80',
                        returnStdout: true
                    ).trim()

                    // Check backend API health endpoint
                    def backendStatus = sh(
                        script: 'curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:80/api/health',
                        returnStdout: true
                    ).trim()

                    echo "Nginx: ${nginxStatus}, Backend API: ${backendStatus}"

                    if (nginxStatus != '200') {
                        error("Nginx health check failed: ${nginxStatus}")
                    }
                    if (backendStatus != '200') {
                        echo "WARNING: Backend API not ready yet (${backendStatus}), may still be starting up"
                    }
                }
            }
        }

        stage('Cleanup') {
            steps {
                sh 'docker image prune -f || true'
                sh 'docker builder prune -f --filter "until=72h" || true'
            }
        }
    }

    post {
        failure {
            script {
                echo 'Deployment FAILED — collecting container logs...'
                sh 'docker compose -f ${DEPLOY_DIR}/docker-compose.yml logs --tail=50 || true'
            }
        }
        success {
            echo 'Deployment successful! Services running on port 80.'
        }
    }
}
