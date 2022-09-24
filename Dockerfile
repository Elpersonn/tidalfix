FROM alpine
RUN ~/tidalfix/install.sh
ENTRYPOINT ["~/tidalfix/start.sh"]