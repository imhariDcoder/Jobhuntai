import os
import tempfile

# Must run before `app.db` (and anything importing it) is first imported,
# so tests never touch the real dev database in backend/data/app.db.
os.environ["SMARTJOBAI_DB_PATH"] = os.path.join(
    tempfile.mkdtemp(prefix="smartjobai_test_db_"), "test.db"
)
