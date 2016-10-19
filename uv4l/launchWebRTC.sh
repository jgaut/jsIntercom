pkill uv4l
uv4l --driver dummy --auto-video_nr –bind-host-address 0.0.0.0 --server-option=--enable-webrtc-video=1 –webrtc-echo-cancellation=1 –webrtc-stun-urls=stun:turn01.uswest.xirsys.com
