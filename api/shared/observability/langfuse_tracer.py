class LangfuseTracer:
    def __init__(self):
        self.enabled = False

    def trace(self, name: str, **kwargs):
        return kwargs
