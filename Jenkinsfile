pipeline {
    agent any

    tools { 
        nodejs 'NodeJSv24'
    }

    parameters {
        booleanParam(name: 'PUSH_CODE', defaultValue: false, description: 'Deploy the code after successful checks?')
    }

    environment {
        DEST_REPO = 'git@github.com:FIN-GIT-DCE-US00407852/acom-sirius-eds.git'
        DEST_REPO_STAGE = 'git@github.com:FIN-GIT-DCE-US00407852/acom-sirius-eds-stage.git'
        DEST_REPO_PROD = 'git@github.com:FIN-GIT-DCE-US00407852/acom-sirius-eds-prod.git'
        SONAR_PROJECT_KEY = 'AEM-Edge-Delivery' // Replace with your SonarQube project key
        SONAR_PROJECT_NAME = 'AEM Edge Delivery' // Replace with your SonarQube project name
        SONAR_HOST = 'https://sonarqube.svc-19.aws.agilent.net'
    }

    options {
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        stage('Clone and Prepare Mirror') {
            steps {
                withCredentials([usernameColonPassword(credentialsId: '4afa737d-d82b-4f38-bb27-7e7e9a9f6445', variable: 'BITBUCKET_USERPASS')]) {
                    sh """
                        curl -u $BITBUCKET_USERPASS \
                            -H "Content-Type: application/json" \
                            -X POST "https://sparksource.collaboration.agilent.com/rest/build-status/1.0/commits/${env.GIT_COMMIT}" \
                            -d '{
                                "state": "INPROGRESS",
                                "key": "jenkins-ci",
                                "name": "CI Build",
                                "url": "${BUILD_URL}",
                                "description": "Build started."
                            }'
                    """
                }
                checkout scm
                script {
                    if (env.BRANCH_NAME == 'main') {
                        env.TARGET_REPO = env.DEST_REPO_PROD
                    } else if (env.BRANCH_NAME == 'stage') {
                        env.TARGET_REPO = env.DEST_REPO_STAGE
                    } else {
                        env.TARGET_REPO = env.DEST_REPO
                    }
                }
                sh '''
                    git remote | grep -q '^github$' && git remote remove github
                    git remote add github ${TARGET_REPO}
                '''
            }
        }

        stage('NPM Lint and Test') {
            steps {
                sh '''
                    node -v
                    npm -v

                    npm ci
                    npm run lint
                    npm test
                '''
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'Sonarcreds', usernameVariable: 'SONAR_USER', passwordVariable: 'SONAR_PASS')]) {
                    sh '''
                        # Install SonarScanner CLI temporarily
                        mkdir -p /tmp/sonar-scanner
                        cd /tmp/sonar-scanner
                        curl -sSLo scanner.zip https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-5.0.1.3006-linux.zip
                        unzip scanner.zip
                        export PATH=$PATH:/tmp/sonar-scanner/sonar-scanner-5.0.1.3006-linux/bin

                        # Import SonarQube CA certificate to truststore
                        keytool -importcert -trustcacerts -alias sonarqube-root \
                        -file /usr/lib/jenkins/sonar/sonarqube-root.crt \
                        -keystore /tmp/sonar-scanner/sonar-scanner-5.0.1.3006-linux/jre/lib/security/cacerts \
                        -storepass changeit
                        
                        # Import SonarQube server certificate to truststore
                        keytool -importcert -trustcacerts -alias sonarqube-server \
                        -file /usr/lib/jenkins/sonar/sonarqube-server.crt \
                        -keystore /tmp/sonar-scanner/sonar-scanner-5.0.1.3006-linux/jre/lib/security/cacerts \
                        -storepass changeit

                        # Go back to project root
                        cd $WORKSPACE

                        # Create sonar-project.properties if it doesn't exist
                        if [ ! -f sonar-project.properties ]; then
                          cat <<EOF > sonar-project.properties
sonar.projectKey=${SONAR_PROJECT_KEY}
sonar.projectName=${SONAR_PROJECT_NAME}
sonar.projectVersion=1.0
sonar.sources=.
sonar.host.url=${SONAR_HOST}
sonar.scanner.truststorePath=/tmp/sonar-scanner/sonar-scanner-5.0.1.3006-linux/jre/lib/security/cacerts
sonar.scanner.truststorePassword=changeit
EOF
                        fi

                        # Run analysis
                        sonar-scanner \
                            -Dsonar.login=$SONAR_USER \
                            -Dsonar.password=$SONAR_PASS
                    '''
                }
            }
            post {
                always {
                    sh '''
                        echo "Cleaning up SonarScanner CLI..."
                        rm -rf /tmp/sonar-scanner
                    '''
                }
            }
        }

        stage('Polaris (Coverity) Analysis') {
            steps {
                polaris arguments: 'analyze -w', polarisCli: 'Polaris CLI'
            }
        }

        // Uncomment the following stages if you have the necessary plugins and configurations set up
        // stage('Quality Gate Check') {
        //     steps {
        //         timeout(time: 5, unit: 'MINUTES') {
        //             waitForQualityGate abortPipeline: true
        //         }
        //     }
        // }

        // Commented out due to pipeline being stopped even for LOW severity items
        // stage('Polaris Issue Check') {
        //     steps {
        //         polarisIssueCheck()
        //     }
        // }

        stage('Push via SSH (ED25519)') {
            when {
                anyOf {
                    // Push if NOT one of the protected branches
                    not {
                        expression {
                            return ['main', 'stage', 'qa1'].contains(env.BRANCH_NAME)
                        }
                    }
                    // OR if it IS a protected branch AND manual push was selected
                    allOf {
                        expression {
                            return ['main', 'stage', 'qa1'].contains(env.BRANCH_NAME)
                        }
                        expression {
                            return params.PUSH_CODE
                        }
                    }
                }
            }
            steps {
                script {
                    if (['stage', 'qa1'].contains(env.BRANCH_NAME)) {
                        env.TARGET_BRANCH = 'main'
                    } else {
                        env.TARGET_BRANCH = env.BRANCH_NAME
                    }
                    if (env.BRANCH_NAME == 'main') {
                        env.GITHUB_CREDENTIALS_ID = 'CloudJenkins-GitHub-Integration-prod'
                    } else if (env.BRANCH_NAME == 'stage') {
                        env.GITHUB_CREDENTIALS_ID = 'CloudJenkins-GitHub-Integration-stg'
                    } else {
                        env.GITHUB_CREDENTIALS_ID = 'CloudJenkins-GitHub-Integration'
                    }
                }
                withCredentials([sshUserPrivateKey(credentialsId: env.GITHUB_CREDENTIALS_ID, keyFileVariable: 'SSH_KEY_PATH')]) {
                    sh '''
                        # Add GitHub to known hosts
                        ssh-keyscan -t ED25519 github.com >> ~/.ssh/known_hosts

                        # Push all refs to the destination
                        export GIT_SSH_COMMAND="ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=yes"
                        git push -f github HEAD:refs/heads/${TARGET_BRANCH}
                    '''
                }
            }
        }
    }
    post {
        failure {
            echo '❌ Pipeline failed. Code will not be deployed.'
            withCredentials([usernameColonPassword(credentialsId: '4afa737d-d82b-4f38-bb27-7e7e9a9f6445', variable: 'BITBUCKET_USERPASS')]) {
                sh """
                    curl -u $BITBUCKET_USERPASS \
                        -H "Content-Type: application/json" \
                        -X POST "https://sparksource.collaboration.agilent.com/rest/build-status/1.0/commits/${env.GIT_COMMIT}" \
                        -d '{
                            "state": "FAILED",
                            "key": "jenkins-ci",
                            "name": "CI Build",
                            "url": "${BUILD_URL}",
                            "description": "Build started."
                        }'
                """
            }
        }
        success {
            script {
                if (['main', 'stage', 'qa1'].contains(env.BRANCH_NAME) && !params.PUSH_CODE) {
                    echo "✅ Build passed but code not deployed — protected branch (${env.BRANCH_NAME}). Manual trigger required."
                } else {
                    echo "✅ All checks passed and code was deployed (if applicable)."
                }
            }
            withCredentials([usernameColonPassword(credentialsId: '4afa737d-d82b-4f38-bb27-7e7e9a9f6445', variable: 'BITBUCKET_USERPASS')]) {
                sh """
                    curl -u $BITBUCKET_USERPASS \
                        -H "Content-Type: application/json" \
                        -X POST "https://sparksource.collaboration.agilent.com/rest/build-status/1.0/commits/${env.GIT_COMMIT}" \
                        -d '{
                            "state": "SUCCESSFUL",
                            "key": "jenkins-ci",
                            "name": "CI Build",
                            "url": "${BUILD_URL}",
                            "description": "Build started."
                        }'
                """
            }
        }
    }
}
