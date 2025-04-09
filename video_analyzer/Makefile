build:
	docker build -t ballskicker-video-analyser:latest .

build-deploy:
	docker build --platform linux/amd64 -t ballskicker-video-analyser:latest .
	docker tag ballskicker-video-analyser:latest 688567303531.dkr.ecr.eu-west-2.amazonaws.com/ballskicker-video-analyser:latest
	docker push 688567303531.dkr.ecr.eu-west-2.amazonaws.com/ballskicker-video-analyser:latest

docker-auth:
	AWS_PROFILE=padel-ai-ecr aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 688567303531.dkr.ecr.eu-west-2.amazonaws.com
