import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
from app.voice.commands import VoiceCommandExecutor
from app.voice.service import VoiceService


def test_command_executor_date_time():
    res_date = VoiceCommandExecutor.execute("tell me today's date")
    assert res_date.handled is True
    assert res_date.action_type == "system_query"
    assert "Today is" in res_date.message

    res_time = VoiceCommandExecutor.execute("what is the time")
    assert res_time.handled is True
    assert res_time.action_type == "system_query"
    assert "The time is" in res_time.message


def test_command_executor_apps(monkeypatch):
    launched = []
    monkeypatch.setattr(subprocess, "Popen", lambda command, **kwargs: launched.append(command))
    res_calc = VoiceCommandExecutor.execute("open calculator")
    assert res_calc.handled is True
    assert res_calc.action_type == "app_launch"
    assert "Calculator" in res_calc.message

    res_notepad = VoiceCommandExecutor.execute("open notepad")
    assert res_notepad.handled is True
    assert res_notepad.action_type == "app_launch"
    assert "Notepad" in res_notepad.message
    assert launched == [["calc.exe"], ["notepad.exe"]]


def test_browser_commands_are_routed_to_floating_browser(monkeypatch):
    launched = []
    monkeypatch.setattr(subprocess, "Popen", lambda command, **kwargs: launched.append(command))
    for transcript in (
        "open youtube",
        "open youtube.com",
        "go to github.com",
        "search for python tutorials",
        "open chrome",
        "open edge",
        "open browser",
    ):
        assert VoiceCommandExecutor.execute(transcript).handled is False
    assert launched == []


def test_command_executor_security_rejection():
    # Arbitrary dangerous commands should never be executed
    res_danger = VoiceCommandExecutor.execute("rm -rf /")
    assert res_danger.handled is False

    res_danger2 = VoiceCommandExecutor.execute("format c:")
    assert res_danger2.handled is False

    res_danger3 = VoiceCommandExecutor.execute("powershell Invoke-Expression")
    assert res_danger3.handled is False
    assert VoiceCommandExecutor.execute("open command prompt").handled is False
    assert VoiceCommandExecutor.execute("open terminal").handled is False


def test_command_executor_general_llm_question():
    res_llm = VoiceCommandExecutor.execute("explain machine learning")
    assert res_llm.handled is False


def test_voice_service_empty_audio():
    svc = VoiceService.get_instance()
    # Empty audio should return empty response without crashing
    res = svc._transcribe_sync(b"", "empty.webm")
    assert res.text == ""
    assert res.executed_command is False


def test_voice_service_transcribes_with_auto_language_and_vad():
    calls = []

    class FakeModel:
        def transcribe(self, audio_path, **kwargs):
            calls.append((audio_path, kwargs))
            return (
                iter([SimpleNamespace(text=" hello "), SimpleNamespace(text="world")]),
                SimpleNamespace(
                    language="en",
                    language_probability=0.98,
                    duration=1.2,
                ),
            )

    svc = VoiceService()
    svc._model = FakeModel()
    response = svc._transcribe_sync(b"x" * 200, "speech.webm")

    assert response.text == "hello world"
    assert response.language == "en"
    assert response.executed_command is False
    assert calls[0][1]["language"] is None
    assert calls[0][1]["vad_filter"] is True
    assert not Path(calls[0][0]).exists()


@pytest.mark.asyncio
async def test_voice_model_load_runs_once(monkeypatch):
    created = []

    class FakeWhisperModel:
        def __init__(self, *args, **kwargs):
            created.append((args, kwargs))

    monkeypatch.setitem(
        __import__("sys").modules,
        "faster_whisper",
        SimpleNamespace(WhisperModel=FakeWhisperModel),
    )
    svc = VoiceService()

    await svc.load_model()
    await svc.load_model()

    assert len(created) == 1
    assert created[0][0] == ("base",)
    assert created[0][1]["device"] == "cpu"
    assert created[0][1]["compute_type"] == "int8"


@pytest.mark.asyncio
async def test_voice_api_endpoints(monkeypatch):
    import httpx
    from app.main import create_app

    monkeypatch.setattr(VoiceService, "_instance", None)
    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Test health
        resp = await client.get("/api/v1/voice/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["model_size"] == "base"
        assert data["device"] == "cpu"
        assert data["compute_type"] == "int8"
        assert data["status"] == "loading"

        # Test execute command
        resp = await client.post(
            "/api/v1/voice/execute",
            params={"transcript": "tell me today's date"},
        )
        assert resp.status_code == 200
        assert resp.json()["handled"] is True
        assert "Today is" in resp.json()["message"]

        # Test empty audio upload
        files = {"file": ("audio.webm", b"", "audio/webm")}
        resp = await client.post("/api/v1/voice/transcribe", files=files)
        assert resp.status_code == 200
        assert resp.json()["text"] == ""

        files = {"file": ("audio.webm", b"x" * 200, "audio/webm")}
        resp = await client.post("/api/v1/voice/transcribe", files=files)
        assert resp.status_code == 503
