build-dev:
	docker build --platform linux/amd64 -t ballskicker-api-service:latest .
	docker tag ballskicker-api-service:latest 688567303531.dkr.ecr.eu-west-2.amazonaws.com/ballskicker-api-service:latest
	docker push 688567303531.dkr.ecr.eu-west-2.amazonaws.com/ballskicker-api-service:latest

docker-auth:
	AWS_PROFILE=padel-ai-ecr aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 688567303531.dkr.ecr.eu-west-2.amazonaws.com
