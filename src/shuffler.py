import random
import copy

class Shuffler:
    def __init__(self, data_manager):
        self.dm = data_manager

    def generate_schedule(self):
        """
        Generates a valid schedule based on constraints.
        Returns a list of 'Team' objects (dictionaries).
        """
        data = self.dm.data
        pairs = data.get("pairs", [])
        classes = data.get("classes", [])
        settings = data.get("settings", {})
        
        # Load constraints for photographers
        students = data.get("students", [])
        photo_exclusions = data.get("photo_exclusions", [])

        if not pairs or not classes:
            return None

        # 1. Prepare Data
        # Map class name to team count
        team_count_map = {c["name"]: int(c["team_count"]) for c in classes}
        
        opening_pairs = [p for p in pairs if p.get("is_opening")]
        ending_pairs = [p for p in pairs if p.get("is_ending")]
        middle_pairs = [p for p in pairs if not p.get("is_opening") and not p.get("is_ending")]

        # 2. Backbone: Distribute middle pairs into teams per class
        # This is a simplified version of 'generateScheduleWithBackbone'
        # We need to group pairs into 'Teams'. A 'Team' is one performance slot.
        # Each class has 'team_count' slots. We distribute pairs evenly.
        
        all_teams = []
        
        # Add Opening Teams (Virtual teams for now, assuming 1 pair per team or grouped)
        # For simplicity, treating each opening pair as a separate team for now, or group by class?
        # Reference logic didn't explicitly group opening/ending into constrained slots same way as middle.
        # Let's assume opening/ending are handled separately or just added.
        # Reference code: "teams = teams.filter(t => !ending.includes(t)).concat(ending);"
        # It implies opening/ending are also 'teams'.
        
        # Let's process middle pairs first.
        class_teams = {} 
        
        for cls_name, count in team_count_map.items():
            cls_pairs = [p for p in middle_pairs if p["class"] == cls_name]
            if not cls_pairs:
                continue
                
            # Create N empty teams
            teams = [{"class": cls_name, "pairs": []} for _ in range(count)]
            
            # Distribute pairs (Simple Round Robin for now)
            # TODO: Implement 'Heavy Dancer' logic if needed later
            for i, p in enumerate(cls_pairs):
                teams[i % count]["pairs"].append(p)
            
            class_teams[cls_name] = teams
            all_teams.extend(teams)

        # 3. Initial Shuffle
        random.shuffle(all_teams)

        # 4. Fix Consecutive Classes (Ensure no same class back-to-back if possible)
        all_teams = self.fix_consecutive_classes(all_teams)

        # 5. Fix Rest Turns (Ensure dancers have rest)
        all_teams = self.fix_rest_turns(all_teams, settings)
        
        # 6. Add Opening/Ending
        # Assuming Opening is at the start and Ending at the end
        # We wrap opening/ending pairs into teams as well
        final_teams = []
        
        if opening_pairs:
            # Group opening pairs by class, or just 1 pair per team
            # Usually opening is one big performance or separate small ones?
            # Let's assume 1 pair = 1 team for now.
            for p in opening_pairs:
                final_teams.append({"class": p["class"], "pairs": [p], "is_opening": True})
        
        final_teams.extend(all_teams)
        
        if ending_pairs:
            for p in ending_pairs:
                final_teams.append({"class": p["class"], "pairs": [p], "is_ending": True})

        # 7. Assign Photographers
        self.assign_photographers(final_teams, students, photo_exclusions, settings)

        return final_teams

    def assign_photographers(self, teams, students, exclusions, settings):
        """
        Assigns a photographer to each team (or each pair in a team).
        Modifies the team objects in-place by adding a 'photographer' field to pairs or team.
        """
        # Exclusions set
        exclude_names = set(exclusions)
        
        # Staff/Newbie exclusion options
        exclude_staff = settings.get("exclude_staff_from_photo", False)
        exclude_newbies = settings.get("exclude_newbies_from_photo", False) # Assuming we can identify newbies?
        # We don't have 'Staff' or 'Newbie' flag in Student model explicitly yet, 
        # unless 'exclusions' list covers it, or we rely on 'role' or specific exclusion list.
        # The user said "Exclusion list is for photo exclusion". So we rely on `exclusions`.
        
        # Candidate Pool: All students minus exclusions
        candidates = [s["nickname"] for s in students if s["nickname"] not in exclude_names]
        
        if not candidates:
            print("No photographers available!")
            return

        # History tracking to ensure fairness/rotation
        # name -> last_photo_turn_index
        photo_history = {} 
        
        # Min rest gap for photographer (e.g. don't shoot immediately after dancing)
        # Using same settings as dance rest or separate? Let's assume 1 or 2 turns.
        min_photo_gap = 1 
        
        for i, team in enumerate(teams):
            # We need one photographer per pair? Or per team?
            # Reference said: "picks.push(pick)" per pair.
            
            team_dancers = self.get_dancers_in_team(team)
            
            # For each pair in the team, assign a photographer
            for pair in team["pairs"]:
                # 1. Filter candidates
                valid_cands = []
                for cand in candidates:
                    # A. Cannot be dancing in this team
                    if cand in team_dancers:
                        continue
                        
                    # B. Cannot be shooting if they danced recently (Rest constraint)
                    # (Optional: check if they are dancing in next turn i+1? - "blocked" in reference)
                    # Let's check immediate neighbors (i-1, i+1)
                    
                    # Check prev turn (i-1) - did they dance?
                    if i > 0:
                        prev_dancers = self.get_dancers_in_team(teams[i-1])
                        if cand in prev_dancers:
                            continue
                            
                    # Check next turn (i+1) - will they dance?
                    if i < len(teams) - 1:
                        next_dancers = self.get_dancers_in_team(teams[i+1])
                        if cand in next_dancers:
                            continue
                    
                    valid_cands.append(cand)
                
                if not valid_cands:
                    pair["photographer"] = "배정 불가"
                    continue
                
                # 2. Pick best candidate (Least recently shot)
                # Sort by last_photo_turn_index (None is -1 or very old)
                valid_cands.sort(key=lambda x: photo_history.get(x, -999))
                
                # Pick from the ones who haven't shot in a while (start of list)
                # To add randomness, pick from top N or just top 1?
                # Let's pick randomly from the top 3 to avoid strict determinism
                top_k = 5
                pool = valid_cands[:top_k]
                pick = random.choice(pool)
                
                pair["photographer"] = pick
                photo_history[pick] = i

    def fix_consecutive_classes(self, teams):
        """
        Reorders teams to minimize consecutive classes.
        Logic: Pick a team from a class that is different from previous and has most remaining teams.
        """
        if not teams: return []
        
        groups = {}
        for t in teams:
            groups.setdefault(t["class"], []).append(t)
            
        result = []
        prev_class = None
        
        total_count = len(teams)
        for _ in range(total_count):
            pick_class = None
            max_remain = -1
            
            # Find best candidate class
            candidates = [c for c in groups.keys() if groups[c]]
            
            # Try to find one different from prev
            valid_candidates = [c for c in candidates if c != prev_class]
            
            if not valid_candidates:
                # Must pick same class (or only one class exists)
                valid_candidates = candidates
            
            if not valid_candidates:
                break # Should not happen if loop logic is correct
                
            # Pick one with most remaining
            for c in valid_candidates:
                if len(groups[c]) > max_remain:
                    max_remain = len(groups[c])
                    pick_class = c
            
            # Add to result
            t = groups[pick_class].pop(0)
            result.append(t)
            prev_class = pick_class
            
        return result

    def fix_rest_turns(self, teams, settings):
        """
        Attempts to swap teams to satisfy min rest constraints.
        """
        min_rest_leader = int(settings.get("min_rest_leader", 2))
        min_rest_follower = int(settings.get("min_rest_follower", 2))
        
        # We'll try a limited number of passes or swaps to avoid infinite loops
        max_passes = 5
        
        for _ in range(max_passes):
            violation_found = False
            last_seen = {} # Dancer -> Index of last appearance
            
            for i in range(len(teams)):
                team = teams[i]
                dancers = self.get_dancers_in_team(team)
                
                current_violation = False
                for d in dancers:
                    last_idx = last_seen.get(d)
                    if last_idx is not None:
                        gap = i - last_idx - 1
                        # Determine role for rest check (simplified: check both or strict?)
                        # Assuming worst case (max requirement) or checking role per pair
                        # Let's use max for safety or specific role check if we tracked it precisely
                        req = min_rest_leader # Defaulting to leader rest for safety
                        if gap < req:
                            current_violation = True
                            break
                    last_seen[d] = i
                
                if current_violation:
                    violation_found = True
                    # Try to swap with a later team
                    if not self.try_swap_forward(teams, i, last_seen, min_rest_leader):
                        pass # Could not fix this specific violation
            
            if not violation_found:
                break
                
        return teams

    def try_swap_forward(self, teams, current_idx, last_seen_map, min_gap):
        """
        Looks for a team ahead (j > current_idx) to swap with, 
        such that swapping doesn't create immediate violations at current_idx.
        """
        for j in range(current_idx + 1, len(teams)):
            # Check if candidate team at j can be moved to current_idx without violation
            cand_team = teams[j]
            cand_dancers = self.get_dancers_in_team(cand_team)
            
            ok_to_move_here = True
            for d in cand_dancers:
                last = last_seen_map.get(d)
                if last is not None:
                    gap = current_idx - last - 1
                    if gap < min_gap:
                        ok_to_move_here = False
                        break
            
            if ok_to_move_here:
                # Swap
                teams[current_idx], teams[j] = teams[j], teams[current_idx]
                return True
        return False

    def get_dancers_in_team(self, team):
        dancers = set()
        for p in team["pairs"]:
            if p["leader"]: dancers.add(p["leader"])
            if p["follower"]: dancers.add(p["follower"])
        return list(dancers)
