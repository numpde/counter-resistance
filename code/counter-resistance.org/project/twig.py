import os
import sys
import logging.handlers

log = logging.getLogger('counter-resistance')
log.setLevel(logging.DEBUG)


# https://stackoverflow.com/questions/52582458/how-can-i-include-the-relative-path-to-a-module-in-a-python-logging-statement
class PackagePathFilter(logging.Filter):
    def filter(self, record):
        record.pathname = record.pathname.replace(os.getcwd(), "").strip('/')
        record.threadName = "" if (record.threadName == "MainThread") else record.threadName
        record.processName = "" if (record.processName == "MainProcess") else record.processName
        return True


formatter = logging.Formatter(
    (
        "[%(levelname).1s %(asctime)s] %(message)s"
        " >> "
        "[%(pathname)s][%(funcName)s:%(lineno)d][%(threadName)s:%(processName)s]"
    ),
    datefmt="%H:%M:%S %Z",
)

ch = logging.StreamHandler(stream=sys.stderr)
ch.setLevel(logging.DEBUG)
ch.setFormatter(formatter)
ch.addFilter(PackagePathFilter())

if log.handlers:
    log.warning(f"Logger has handlers already.")
else:
    log.addHandler(ch)
    log.propagate = False

if __name__ == '__main__':
    log.debug("OHO")
