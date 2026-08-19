#!/bin/sh
while kill -0 23229 2>/dev/null; do
    sleep 5
done

if find /tmp/wirecolor_p1/pub2503_p0_colorized.pdf \
        -newermt '@1784467600' -print -quit 2>/dev/null | grep -q .; then
    exit 0
fi

cd /tmp/wirecolor_p0 || exit 1
exec env PYTHONUNBUFFERED=1 \
    /opt/volvo-assistant/backend/.venv/bin/python \
    -m wirecolor.tools.p1_run --pub 2503
