printf "PID IS $1\n" # printf goated
kill -s SIGTERM $1
printf 'killed!!'
git pull
nohup index.js &
printf $! > index.js.pid