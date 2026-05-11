import pandas as pd

# read CSV
df = pd.read_csv("diet_clean.csv", sep=";")

# remove repeated headers
df = df[df["Datum"] != "Datum"]

# create continuous dates
dates = pd.date_range(
    start="2020-01-13",
    end="2026-05-10",
    freq="D"
)

# make sure lengths match
df = df.iloc[:len(dates)].copy()

# assign proper dates
df["Datum"] = dates.strftime("%Y-%m-%d")

# save cleaned CSV
df.to_csv(
    "diet_clean_dates.csv",
    sep=";",
    index=False,
    encoding="utf-8-sig"
)